"""
Run EquityLensNG on your machine for testing: python app.py

Installs what's missing, builds the React app when its sources changed, and starts the API
with the built app on http://localhost:8000 over the local test server (frontend/e2e/serve.py):
a throwaway in-memory database with synthetic NGX data, never Atlas. Ctrl+C stops it.
With --live the market data is real instead: a read-only copy of the crawler's collections from the
Atlas database in backend/.env (frontend/e2e/live.py). Logins, watchlists, emails and AI stay local.
backend/ and frontend/ stay the deployable build; this file is for local testing only.

Under Streamlit (streamlit run app.py, or a host still pointed at app.py) it runs the legacy
Streamlit app in streamlit_app.py instead, so the live app keeps working until cutover.

    python app.py              # build if needed, start, open the browser
    python app.py --port 8001  # when something already listens on :8000
    python app.py --no-open    # don't open the browser
    python app.py --rebuild    # build the React app even if it looks current
    python app.py --live       # real prices and news, copied read-only from Atlas
"""

import argparse
import os
import runpy
import shutil
import socket
import subprocess
import sys
import time
import urllib.request
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
SERVER = FRONTEND / "e2e" / "serve.py"
OUTBOX = FRONTEND / "e2e" / ".outbox.jsonl"
DIST = FRONTEND / "dist" / "index.html"
# the build's inputs: a change in any of these means dist/ is out of date
SOURCES = [FRONTEND / "src", FRONTEND / "public", FRONTEND / "index.html", FRONTEND / "package.json",
           FRONTEND / "vite.config.ts", ROOT / "design", ROOT / "brand"]
# copies made by npm run sync:tokens, which every build rewrites, so they never count as changes
COPIES = {FRONTEND / "src" / "styles" / "tokens.css", FRONTEND / "public" / "brand",
          FRONTEND / "public" / "favicon.svg"}
# seeded by backend/tests/conftest.py
LOGINS = [("Admin", "admin@example.com", "Lens-admin-pass-2026"), ("User", "ada@example.com", "Ada-reads-charts-daily")]


def _under_streamlit() -> bool:
    try:
        from streamlit import runtime
    except ImportError:
        return False
    return runtime.exists()


def _fail(message: str) -> None:
    print(f"\n[x] {message}", file=sys.stderr)
    sys.exit(1)


def _tool(name: str, hint: str) -> str:
    path = shutil.which(name)
    if not path:
        _fail(f"{name} isn't installed or isn't on PATH. {hint}")
    return path


def _run(cmd: list[str], cwd: Path, env: dict[str, str]) -> None:
    print(f"    $ {Path(cmd[0]).stem} {' '.join(cmd[1:])}  (in {cwd.name}/)")
    if subprocess.call(cmd, cwd=cwd, env=env) != 0:
        _fail("That step failed; the output above says why.")


def _newest(paths: list[Path]) -> float:
    newest = 0.0
    for p in paths:
        if p in COPIES or not p.exists():
            continue
        if p.is_file():
            newest = max(newest, p.stat().st_mtime)
            continue
        for dirpath, dirnames, filenames in os.walk(p):
            d = Path(dirpath)
            dirnames[:] = [n for n in dirnames if d / n not in COPIES]
            for n in filenames:
                if d / n not in COPIES:
                    newest = max(newest, (d / n).stat().st_mtime)
    return newest


def _port_busy(port: int) -> bool:
    with socket.socket() as s:
        s.settimeout(0.5)
        return s.connect_ex(("127.0.0.1", port)) == 0


def _wait_ready(url: str, proc: subprocess.Popen, timeout: float = 240) -> bool:
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        if proc.poll() is not None:
            return False
        try:
            with urllib.request.urlopen(url, timeout=2) as r:
                if r.status == 200:
                    return True
        except OSError:
            pass
        time.sleep(1)
    return False


def _stop(proc: subprocess.Popen, grace: float) -> None:
    """Stop uv, the API and its in-memory mongod, giving them `grace` seconds to exit on their own."""
    try:
        proc.wait(timeout=grace)
        return
    except subprocess.TimeoutExpired:
        pass
    if os.name == "nt":  # terminate() would stop uv alone and leave the API and mongod running
        subprocess.call(["taskkill", "/T", "/F", "/PID", str(proc.pid)],
                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    else:
        proc.terminate()
    proc.wait()


def main() -> None:
    parser = argparse.ArgumentParser(description="Run EquityLensNG locally on synthetic or copied live data.")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--no-open", action="store_true", help="don't open the browser")
    parser.add_argument("--rebuild", action="store_true", help="build the React app even if it looks current")
    parser.add_argument("--live", action="store_true",
                        help="copy real market data read-only from the Atlas database in backend/.env")
    args = parser.parse_args()
    sys.stdout.reconfigure(line_buffering=True)  # progress shows at once, also when piped to a file

    uv = _tool("uv", "Install it from https://docs.astral.sh/uv/ and run this again.")
    npm = _tool("npm", "Install Node.js 22 or newer from https://nodejs.org and run this again.")
    if not SERVER.exists():
        _fail(f"{SERVER.relative_to(ROOT)} is missing. It's the local test server, which is never committed (D-11); "
              "restore frontend/e2e/ and backend/tests/ from your private backup.")
    if args.live and not (BACKEND / ".env").exists():
        _fail("--live reads MONGODB_URI and MONGODB_DB from backend/.env, which is missing (see backend/.env.example).")
    if _port_busy(args.port):
        _fail(f"Something already listens on port {args.port}. Stop it, or run: python app.py --port {args.port + 1}")

    # uv warns when another virtualenv (e.g. stock_env) is active; the backend uses its own .venv
    env = {k: v for k, v in os.environ.items() if k != "VIRTUAL_ENV"}

    print("EquityLensNG, local test run\n")
    lock, installed = FRONTEND / "package-lock.json", FRONTEND / "node_modules" / ".package-lock.json"
    if not installed.exists() or lock.stat().st_mtime > installed.stat().st_mtime:
        print("[1/3] Installing the React app's packages")
        _run([npm, "ci"], FRONTEND, env)
    else:
        print("[1/3] React app's packages are installed")

    if args.rebuild or not DIST.exists() or _newest(SOURCES) > DIST.stat().st_mtime:
        print("[2/3] Building the React app")
        _run([npm, "run", "build"], FRONTEND, env)
    else:
        print("[2/3] React build is up to date")

    if args.live:
        print("[3/3] Copying live market data from Atlas (read-only), then starting the API")
    else:
        print("[3/3] Starting the API on synthetic data (installs the backend's packages on first run)")
    url = f"http://localhost:{args.port}"
    server_env = {**env, "E2E_PORT": str(args.port), "E2E_LIVE": "1" if args.live else "0"}
    proc = subprocess.Popen([uv, "run", "python", str(SERVER)], cwd=BACKEND, env=server_env)
    try:
        if not _wait_ready(f"http://127.0.0.1:{args.port}/api/v1/readyz", proc):
            _stop(proc, grace=0)
            _fail("The API didn't start; the output above says why.")
        print(f"\nReady: {url}\n")
        for role, email, password in LOGINS:
            print(f"    {role:<6} {email}  /  {password}")
        if args.live:
            print("\n    Prices and news are a copy of Atlas: nothing you do here reaches it. AI readings are canned.")
            print("    Logins, watchlists and invites are local and reset when you stop.")
        else:
            print("\n    Data is synthetic and resets when you stop. AI readings are canned test text.")
        print(f"    Invite and reset emails aren't sent: their links are in {OUTBOX.relative_to(ROOT)}")
        print("    Ctrl+C to stop.\n")
        if not args.no_open:
            webbrowser.open(url)
        while proc.poll() is None:  # short waits, so Ctrl+C gets through on Windows
            time.sleep(0.5)
    except KeyboardInterrupt:
        print("\nStopping...")
    finally:
        _stop(proc, grace=10)  # Ctrl+C reaches the API too, which shuts down by itself


if _under_streamlit():
    # the legacy app; Streamlit reruns this file on every interaction, and each rerun hands over again
    runpy.run_path(str(ROOT / "streamlit_app.py"), run_name="__main__")
elif __name__ == "__main__":
    main()
