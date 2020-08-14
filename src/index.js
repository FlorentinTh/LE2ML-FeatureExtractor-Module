/* eslint-disable no-unused-vars */
import Config from './utils/config';
import APIHelper from './helpers/api.helper';
import Task from './task';
const config = Config.getConfig();

const baseApiUrl = config.api.url + '/v' + config.api.version;
APIHelper.setBaseUrl(baseApiUrl);

(async () => {
  const task = new Task();
  await task.init();
})();
