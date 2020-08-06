/* eslint-disable no-unused-vars */
import fs from 'fs';
import path from 'path';
import LineByLineReader from 'line-by-line';
import Config from './utils/config';
import APIHelper from './helpers/api.helper';
import Logger from './utils/logger';

const config = Config.getConfig();

const baseApiUrl = config.api.url + '/v' + config.api.version;
APIHelper.setBaseUrl(baseApiUrl);

const basePath = path.join(__dirname, '..', 'job');
const containerName = 'core-features';
const outputDest = path.join(basePath, 'features', 'core-features.csv');

(async () => {
  let conf;
  try {
    conf = await getConf();
    let featuresList;
    try {
      featuresList = await getFeaturesList(conf);
      let windowLength;
      try {
        windowLength = await getWindow(conf);

        const inputDataPath = path.join(basePath, 'small.csv');
        const lineReader = new LineByLineReader(inputDataPath, { skipEmptyLines: true });

        try {
          await fs.promises.access(outputDest);
        } catch (error) {
          if (error.code === 'ENOENT') {
            try {
              await fs.promises.mkdir(path.dirname(outputDest));
            } catch (error) {
              Logger.error('[Container] Error: Impossible to create output directory');
              // TODO CALL API ERROR ROUTE
            }
          }
        }

        const writeStream = fs.createWriteStream(outputDest, {
          encoding: 'utf-8'
        });

        let counter = 0;
        let tempData;

        lineReader.on('line', async line => {
          const lineArr = line.split(',');
          if (counter === 0) {
            tempData = await initData(lineArr);
          } else {
            for (let i = 0; i < lineArr.length; ++i) {
              tempData['col_' + i].data.push(lineArr[i]);
            }

            if (counter % windowLength === 0) {
              lineReader.pause();
              // console.log(tempData);
              for (let i = 0; i < lineArr.length; ++i) {
                tempData['col_' + i].data = [];
              }
              lineReader.resume();
            }
          }

          ++counter;
        });

        lineReader.on('end', () => {});
      } catch (error) {
        Logger.error('[Container] ' + error);
        // TODO CALL API ERROR ROUTE
      }
    } catch (error) {
      Logger.error('[Container] ' + error);
      // TODO CALL API ERROR ROUTE
    }
  } catch (error) {
    Logger.error('[Container] ' + error);
    // TODO CALL API ERROR ROUTE
  }
})();

async function getConf() {
  const confPath = path.join(basePath, 'conf.json');

  let file;
  try {
    file = await fs.promises.readFile(confPath);
  } catch (error) {
    throw new Error('Cannot open configuration file');
  }

  return JSON.parse(file);
}

async function getFeaturesList(conf) {
  const featuresListObj = conf.features.list;

  if (featuresListObj === undefined) {
    throw new Error('Configuration cannot be parsed for features property.');
  }

  const featuresList = [];

  for (let i = 0; i < featuresListObj.length; ++i) {
    const featureObj = featuresListObj[i];
    if (featureObj.container === containerName) {
      featuresList.push(featureObj.label);
    }
  }

  return featuresList;
}

async function getWindow(conf) {
  const isWindowingTask = conf.windowing.enable;

  if (!(isWindowingTask.constructor === Boolean)) {
    throw new Error('Configuration cannot be parsed for windowing property');
  }

  if (isWindowingTask) {
    if (!conf.windowing.parameters) {
      throw new Error('Configuration cannot be parsed for windowing property');
    }

    const windowLength = conf.windowing.parameters.length;

    if (windowLength === 0 || windowLength > 200) {
      throw new Error(
        'Configuration is not valid. Window length should be between 0 and 200'
      );
    }

    return windowLength;
  } else {
    return 1;
  }
}

async function initData(headers) {
  return new Promise(resolve => {
    const data = {};
    for (let i = 0; i < headers.length; ++i) {
      const header = headers[i];
      data['col_' + i] = {};

      if (!(header === 'label')) {
        let sensor;
        if (header.includes('acc')) {
          sensor = 'acc';
        } else if (header.includes('gyr')) {
          sensor = 'gy';
        } else if (header.includes('mag')) {
          sensor = 'mag';
        }

        data['col_' + i].sensor = sensor;

        let axis;
        if (header.includes('_x')) {
          axis = 'x';
        } else if (header.includes('_y')) {
          axis = 'y';
        } else if (header.includes('_z')) {
          axis = 'z';
        }

        data['col_' + i].axis = axis;
        data['col_' + i].data = [];
      } else {
        data['col_' + i].data = [];
      }
    }
    resolve(data);
  });
}
