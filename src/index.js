/* eslint-disable no-unused-vars */
import fs from 'fs';
import path from 'path';
import LineByLineReader from 'line-by-line';
import Config from './utils/config';
import APIHelper from './helpers/api.helper';
import Logger from './utils/logger';
import Feature from './features/Feature';

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
        windowLength = await getWindowLength(conf);

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

        let lineCounter = 0;
        let resCounter = 0;
        let tempData;

        lineReader.on('line', async line => {
          lineReader.pause();
          const lineArr = line.split(',');
          if (lineCounter === 0) {
            tempData = await initData(lineArr);
          } else {
            for (let i = 0; i < lineArr.length - 1; ++i) {
              if (tempData['col_' + i].data.length === windowLength) {
                tempData['col_' + i].data = [];
              }
              tempData['col_' + i].data.push(lineArr[i]);
            }

            if (lineCounter % windowLength === 0) {
              const result = {};
              const totals = [];

              for (let i = 0; i < featuresList.length; ++i) {
                const featureLabel = featuresList[i];
                let tmpSensor;

                for (let j = 0; j < lineArr.length - 1; ++j) {
                  let itemLabel;
                  if (!featureLabel.includes('total')) {
                    itemLabel =
                      featureLabel +
                      '.' +
                      tempData['col_' + j].sensor +
                      '_' +
                      tempData['col_' + j].axis;

                    const signal = tempData['col_' + j].data;
                    const feature = new Feature(signal);

                    result[itemLabel] = await feature.compute(featureLabel);
                  } else {
                    if (
                      tmpSensor === undefined ||
                      !(tmpSensor === tempData['col_' + j].sensor)
                    ) {
                      itemLabel = featureLabel + '.' + tempData['col_' + j].sensor;
                      result[itemLabel] = 0;
                      tmpSensor = tempData['col_' + j].sensor;
                      totals.push(itemLabel);
                    }
                  }
                }
              }

              result.label = lineArr[lineArr.length - 1];

              // computeTotals;
              for (let i = 0; i < totals.length; ++i) {
                const featureLabel = totals[i]
                  .split('.')[0]
                  .split('_')
                  .slice(0, -1)
                  .join('_');
                const sensor = totals[i].split('.')[1].split('_')[0];

                const keys = Object.keys(result);
                const signal = [];
                for (let j = 0; j < keys.length; ++j) {
                  if (
                    keys[j].includes(featureLabel) &&
                    keys[j].includes(sensor) &&
                    !keys[j].includes('total')
                  ) {
                    signal.push(result[keys[j]]);
                  }
                }

                const feature = new Feature(signal);
                result[totals[i]] = await feature.compute('average');
              }

              // WriteResHeader
              if (resCounter === 0) {
                const resHeaders = Object.keys(result);
                writeStream.write(resHeaders.join(','));
              }

              // WriteResLine
              writeStream.write('\n' + Object.values(result).join(','));
              ++resCounter;
            }
          }

          ++lineCounter;
          lineReader.resume();
        });

        lineReader.once('end', async () => {
          lineReader.close();
          writeStream.end();
        });

        lineReader.on('error', error => {
          Logger.error('[Container] ' + error);
          // TODO CALL API ERROR ROUTE
        });
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
  return new Promise((resolve, reject) => {
    const featuresListObj = conf.features.list;

    if (featuresListObj === undefined) {
      reject(new Error('Configuration cannot be parsed for features property.'));
    }

    const featuresList = [];

    for (let i = 0; i < featuresListObj.length; ++i) {
      const featureObj = featuresListObj[i];
      if (featureObj.container === containerName) {
        featuresList.push(featureObj.label);
      }
    }

    resolve(featuresList);
  });
}

async function getWindowLength(conf) {
  return new Promise((resolve, reject) => {
    const isWindowingTask = conf.windowing.enable;

    if (!(isWindowingTask.constructor === Boolean)) {
      reject(new Error('Configuration cannot be parsed for windowing property'));
    }

    if (isWindowingTask) {
      if (!conf.windowing.parameters) {
        reject(new Error('Configuration cannot be parsed for windowing property'));
      }

      const length = conf.windowing.parameters.length;

      if (length === 0 || length > 200) {
        reject(
          new Error(
            'Configuration is not valid. Window length should be between 0 and 200'
          )
        );
      }

      resolve(length);
    } else {
      resolve(1);
    }
  });
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
          sensor = 'gyr';
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
        data['col_' + i].data = null;
      }
    }
    resolve(data);
  });
}
