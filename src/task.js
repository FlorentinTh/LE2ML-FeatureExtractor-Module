import Logger from './utils/logger';
import Config from './utils/config';
import APIHelper from './helpers/api.helper';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import Extractor from './features/Extractor';

const config = Config.getConfig();

class Task {
  constructor() {
    this.name = 'features';
    this.state = 'started';
    this.containerName = config.container_name;
    this.user = config.data.user_id;
    this.job = config.data.job_id;
  }

  async init() {
    Logger.info(
      `[Container] Info: user - ${this.user} starts the container ${this.containerName} to achieve feature extraction task for job - ${this.job}`
    );

    let conf;
    let features;
    let windowLength;

    try {
      conf = await this.getConf();
      features = await this.getFeatures(conf);
      windowLength = await this.getWindowLength(conf);
    } catch (error) {
      Logger.error('[Container] ' + error);
      return await this.error();
    }

    const isWindowing = conf.windowing.enable;
    let input;
    if (isWindowing) {
      input = path.join(config.data.base_path, 'windowing.csv');
    } else {
      input = path.join(config.data.base_path, conf.input.file.filename);
    }

    try {
      const extractor = new Extractor(input, this.containerName, windowLength, features);
      await extractor.extract();
    } catch (error) {
      Logger.error('[Container] ' + error);
      return await this.error();
    }

    this.state = 'completed';
    await this.success();
  }

  async getConf() {
    const confPath = path.resolve(config.data.base_path, 'conf.json');
    let file;
    try {
      file = await fs.promises.readFile(confPath);
    } catch (error) {
      throw new Error('Cannot open configuration file');
    }

    return JSON.parse(file);
  }

  async getFeatures(conf) {
    return new Promise((resolve, reject) => {
      const featuresListObj = conf.features.list;

      if (featuresListObj === undefined) {
        reject(new Error('Configuration cannot be parsed for features property.'));
      }

      const featuresList = [];

      for (let i = 0; i < featuresListObj.length; ++i) {
        const featureObj = featuresListObj[i];
        if (featureObj.container === this.containerName) {
          featuresList.push(featureObj.label);
        }
      }

      resolve(featuresList);
    });
  }

  async getWindowLength(conf) {
    return new Promise((resolve, reject) => {
      const isWindowingTask = conf.windowing.enable;

      if (!(isWindowingTask.constructor === Boolean)) {
        reject(new Error('Configuration cannot be parsed for windowing property'));
      }

      if (isWindowingTask) {
        if (!conf.windowing.parameters) {
          reject(new Error('Configuration cannot be parsed for windowing property'));
        }

        const length = conf.windowing.parameters.length.match(/(\d+)/)[0];

        if (length === 0) {
          reject(
            new Error(
              'Configuration is not valid. Window length should not be equal to 0.'
            )
          );
        }

        resolve(length);
      } else {
        resolve(1);
      }
    });
  }

  async success() {
    axios
      .post(
        `/jobs/${this.job}/tasks/complete`,
        {
          task: this.name,
          state: this.state,
          token: config.data.token
        },
        {
          headers: APIHelper.setAPIKey()
        }
      )
      .then(response => {
        if (response) {
          Logger.info(
            `[API] Info: Feature Extraction task started by user: ${this.user} for job: ${this.job} successfully updated (STATUS: COMPLETED).`
          );
        }
      })
      .catch(error => {
        Logger.error('[API] :' + error);
      });
  }

  async error() {
    axios
      .post(`/jobs/${this.job}/tasks/error?task=${this.name}`, null, {
        headers: APIHelper.setAPIKey()
      })
      .then(response => {
        if (response) {
          Logger.info(
            `[API] Info: Feature Extraction task started by user: ${this.user} for job: ${this.job} successfully updated (STATUS: FAILED).`
          );
        }
      })
      .catch(error => {
        Logger.error('[API] :' + error);
      });
  }
}

export default Task;
