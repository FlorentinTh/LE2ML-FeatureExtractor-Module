import https from 'https';
import axios from 'axios';
import Config from '../utils/config';

const config = Config.getConfig();

class APIHelper {
  static setBaseUrl(url, proxy = false) {
    if (!(url.constructor === String)) {
      throw new Error('Expected type for argument url is String.');
    }

    if (!(proxy.constructor === Boolean)) {
      throw new Error('Expected type for argument proxy is Boolean.');
    }

    if (proxy) {
      axios.defaults.baseURL = config.api.proxy + '/' + url;
    } else {
      axios.defaults.baseURL = url;
    }

    axios.defaults.httpsAgent = new https.Agent({ rejectUnauthorized: false });
  }

  static setAPIKey() {
    return {
      'App-Key': config.api.app_key
    };
  }
}

export default APIHelper;
