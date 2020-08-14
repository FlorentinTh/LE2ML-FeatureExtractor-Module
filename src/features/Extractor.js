import LineByLineReader from 'line-by-line';
import fs from 'fs';
import path from 'path';
import Config from '../utils/config';
import Feature from './Feature';

const config = Config.getConfig();

class Extractor {
  constructor(input, containerName, windowLength, features) {
    this.input = input;
    this.containerName = containerName;
    this.windowLength = windowLength;
    this.features = features;
    this.lineReader = undefined;
    this.outputFile = undefined;
    this.processingData = undefined;
    this.result = {};
    this.correlations = [];
    this.totals = [];
    this.init();
  }

  async init() {
    this.lineReader = new LineByLineReader(this.input, { skipEmptyLines: true });

    await this.makeOutput();
  }

  async makeOutput() {
    const outputFolderPath = path.join(
      config.data.base_path,
      config.data.user_id,
      'jobs',
      config.data.job_id,
      'features'
    );

    try {
      await fs.promises.access(outputFolderPath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        try {
          await fs.promises.mkdir(outputFolderPath);
        } catch (error) {
          throw new Error('[Container] Error: Impossible to create output directory');
        }
      }
    }

    const outputFilePath = path.join(outputFolderPath, `${this.containerName}.csv`);
    this.outputFile = fs.createWriteStream(outputFilePath, {
      encoding: 'utf-8'
    });
  }

  async extract() {
    let lineCounter = 0;
    let resCounter = 0;

    this.lineReader.on('line', async line => {
      this.lineReader.pause();

      line = line.split(',');
      if (lineCounter === 0) {
        this.processingData = await this.initProcessingData(line);
      } else {
        await this.buildProcessingData(line);

        if (lineCounter % this.windowLength === 0) {
          await this.computeFeatures(line);

          if (this.correlations.length > 0) {
            await this.computeCorrelations();
          }

          if (this.totals.length > 0) {
            await this.computeTotals();
          }

          if (resCounter === 0) {
            await this.writeOutputFileHeaders();
          }

          await this.writeOutputFileLine();

          ++resCounter;
        }
      }

      ++lineCounter;
      await this.resetData();
      this.lineReader.resume();
    });

    this.lineReader.once('end', async () => {
      this.lineReader.close();
      this.outputFile.end();
    });

    this.lineReader.on('error', error => {
      throw error;
    });
  }

  async initProcessingData(headers) {
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

  async buildProcessingData(line) {
    for (let i = 0; i < line.length - 1; ++i) {
      if (this.processingData['col_' + i].data.length === this.windowLength) {
        this.processingData['col_' + i].data = [];
      }
      this.processingData['col_' + i].data.push(Number(line[i]));
    }
  }

  async computeFeatures(line) {
    for (let i = 0; i < this.features.length; ++i) {
      const featureLabel = this.features[i];
      let tmpSensor;

      for (let j = 0; j < line.length - 1; ++j) {
        let itemLabel;

        if (!featureLabel.includes('total')) {
          if (!featureLabel.includes('correlations')) {
            itemLabel =
              featureLabel +
              '.' +
              this.processingData['col_' + j].sensor +
              '_' +
              this.processingData['col_' + j].axis;
            const signal = this.processingData['col_' + j].data;
            const feature = new Feature(signal);
            this.result[itemLabel] = await feature.compute(featureLabel);
          } else {
            if (
              tmpSensor === undefined ||
              !(tmpSensor === this.processingData['col_' + j].sensor)
            ) {
              const allAxis = ['x', 'y', 'z', 'total'];
              allAxis.reduce(
                (accumulator, current, index) =>
                  accumulator.concat(
                    allAxis.slice(index + 1).map(value => {
                      const label =
                        featureLabel +
                        '.' +
                        this.processingData['col_' + j].sensor +
                        '_' +
                        current +
                        '_' +
                        value;
                      this.result[label] = 0;
                      tmpSensor = this.processingData['col_' + j].sensor;
                      this.correlations.push(label);
                      return label;
                    })
                  ),
                []
              );
            }
          }
        } else {
          if (
            tmpSensor === undefined ||
            !(tmpSensor === this.processingData['col_' + j].sensor)
          ) {
            itemLabel = featureLabel + '.' + this.processingData['col_' + j].sensor;
            this.result[itemLabel] = 0;
            tmpSensor = this.processingData['col_' + j].sensor;
            this.totals.push(itemLabel);
          }
        }
      }
    }
    this.result.label = line[line.length - 1];
  }

  async computeCorrelations() {
    for (let i = 0; i < this.correlations.length; ++i) {
      const correlation = this.correlations[i].split('.')[1].split('_');
      const correlationSensor = correlation[0];
      const correlationAxisA = correlation[1];
      const correlationAxisB = correlation[2];
      const signals = [];

      Object.keys(this.processingData).map(value => {
        const item = this.processingData[value];
        if (item.sensor === correlationSensor) {
          if (!(correlationAxisB === 'total')) {
            if (item.axis === correlationAxisA || item.axis === correlationAxisB) {
              signals.push(item.data);
            }
          } else {
            signals.push(item.data);
          }
        }
      });

      const feature = new Feature(signals);
      this.result[this.correlations[i]] = await feature.compute('correlation', {
        axisA: correlationAxisA,
        axisB: correlationAxisB
      });
    }
  }

  async computeTotals() {
    for (let i = 0; i < this.totals.length; ++i) {
      const featureLabel = this.totals[i]
        .split('.')[0]
        .split('_')
        .slice(0, -1)
        .join('_');
      const sensor = this.totals[i].split('.')[1].split('_')[0];
      const keys = Object.keys(this.result);
      const signal = [];

      for (let j = 0; j < keys.length; ++j) {
        if (
          keys[j].includes(featureLabel) &&
          keys[j].includes(sensor) &&
          !keys[j].includes('total')
        ) {
          signal.push(this.result[keys[j]]);
        }
      }

      const feature = new Feature(signal);
      this.result[this.totals[i]] = await feature.compute('average');
    }
  }

  async writeOutputFileHeaders() {
    const resHeaders = Object.keys(this.result);
    this.outputFile.write(resHeaders.join(','));
  }

  async writeOutputFileLine() {
    this.outputFile.write('\n' + Object.values(this.result).join(','));
  }

  async resetData() {
    this.result = {};
    this.correlations = [];
    this.totals = [];
  }
}

export default Extractor;
