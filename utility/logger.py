import logging 
import warnings

warnings.filterwarnings("ignore")

def log(message,user, type='INFO'):
    logging.basicConfig(level=logging.DEBUG,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
                    datefmt='%Y-%m-%d %H:%M:%S',
                    handlers=[
                        logging.StreamHandler()
                    ])

    if type=='error':
        logging.error(message)
    else:
        logging.info(message)