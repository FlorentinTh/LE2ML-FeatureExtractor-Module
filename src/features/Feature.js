import FFTReal from './utils/FFTReal';
class Feature {
  constructor(signal) {
    this.signal = signal;
  }

  async compute(label, options = { axisA: null, axisB: null }) {
    if (label === 'average') {
      return await this.average();
    } else if (label === 'std_dev') {
      return await this.deviation();
    } else if (label === 'skewness_normal') {
      return await this.skewness({ adjusted: false });
    } else if (label === 'skewness_adjusted') {
      return await this.skewness({ adjusted: true });
    } else if (label === 'kurtosis_normal') {
      return await this.kurtosis({ adjusted: false });
    } else if (label === 'kurtosis_adjusted') {
      return await this.kurtosis({ adjusted: true });
    } else if (label === 'zero_crossing_rate') {
      return await this.zeroCrossingRate();
    } else if (label === 'correlation') {
      return await this.correlation(options.axisA, options.axisB);
    } else if (label === 'dc_component') {
      return await this.dc();
    } else if (label === 'energy') {
      return await this.energy();
    } else if (label === 'entropy') {
      return await this.entropy();
    } else {
      throw new Error('Feature function does not exist');
    }
  }

  async average(options = { signal: null }) {
    const signal = options.signal === null ? this.signal : options.signal;
    return new Promise(resolve => {
      let sum = 0;
      for (let i = 0; i < signal.length; ++i) {
        sum += Number(signal[i]);
      }

      resolve(Number(sum / signal.length));
    });
  }

  async deviation(options = { signal: null }) {
    const signal = options.signal === null ? this.signal : options.signal;
    const average = await this.average({ signal });

    return new Promise(resolve => {
      let sum = 0;
      for (let i = 0; i < signal.length; ++i) {
        sum += Math.pow(Number(signal[i]) - average, 2);
      }
      resolve(Math.sqrt(sum / signal.length));
    });
  }

  async skewness(options = { adjusted: false }) {
    const average = await this.average();
    const deviation = await this.deviation();

    return new Promise(resolve => {
      let sum = 0;

      if (options.adjusted) {
        for (let i = 0; i < this.signal.length; ++i) {
          sum += Math.pow(Number(this.signal[i]) - average, 3) / Math.pow(deviation, 3);
        }
        resolve(
          (sum *=
            this.signal.length / ((this.signal.length - 1) * (this.signal.length - 2)))
        );
      } else {
        for (let i = 0; i < this.signal.length; ++i) {
          sum += Math.pow(Number(this.signal[i]) - average, 3);
        }
        resolve((sum /= Math.pow(deviation, 3) * this.signal.length));
      }
    });
  }

  async kurtosis(options = { adjusted: false }) {
    const average = await this.average();
    const deviation = await this.deviation();

    return new Promise(resolve => {
      let sum = 0;
      if (options.adjusted) {
        for (let i = 0; i < this.signal.length; ++i) {
          sum += Math.pow(Number(this.signal[i]) - average, 4) / Math.pow(deviation, 4);
        }
        const factor =
          sum *
          ((this.signal.length * (this.signal.length + 1)) /
            ((this.signal.length - 1) *
              (this.signal.length - 2) *
              (this.signal.length - 3)));
        resolve(
          factor -
            (3 * Math.pow(this.signal.length - 1, 2)) /
              ((this.signal.length - 2) * (this.signal.length - 3))
        );
      } else {
        for (let i = 0; i < this.signal.length; ++i) {
          sum += Math.pow(Number(this.signal[i]) - average, 4);
        }
        resolve((sum /= Math.pow(deviation, 4) * this.signal.length));
      }
    });
  }

  async zeroCrossingRate() {
    return new Promise(resolve => {
      let count = 0;
      for (let i = 1; i < this.signal.length; ++i) {
        const product = Number(this.signal[i - 1]) * Number(this.signal[i]);
        if (product < 0) {
          ++count;
        }
      }
      resolve(count / this.signal.length);
    });
  }

  async correlation(axisA, axisB) {
    let signalA;
    let signalB;
    let isTotal = false;
    if (axisB === 'total') {
      if (axisA === 'x') {
        signalA = this.signal[0];
      } else if (axisA === 'y') {
        signalA = this.signal[1];
      } else if (axisA === 'z') {
        signalA = this.signal[2];
      }
      isTotal = true;
    } else {
      signalA = this.signal[0];
      signalB = this.signal[1];
    }

    let sum = 0;
    let sumAvgTotal = 0;

    for (let i = 0; i < signalA.length; ++i) {
      if (!isTotal) {
        sum += Number(signalA[i]) * Number(signalB[i]);
      } else {
        const total =
          Number(this.signal[0][i]) +
          Number(this.signal[1][i]) +
          Number(this.signal[2][i]);
        sumAvgTotal += total;
        sum += Number(signalA[i]) * total;
      }
    }

    sum /= signalA.length;

    let cov;
    let deviation;

    const averageA = await this.average({ signal: signalA });
    const deviationA = await this.deviation({ signal: signalA });
    if (!isTotal) {
      const averageB = await this.average({ signal: signalB });
      cov = sum - averageA * averageB;

      const deviationB = await this.deviation({ signal: signalB });
      deviation = deviationA * deviationB;
    } else {
      const averageTotal = sumAvgTotal / signalA.length;
      cov = sum - averageA * averageTotal;

      let sumDeviation = 0;
      for (let i = 0; i < this.signal.length; ++i) {
        sumDeviation += await this.deviation({ signal: this.signal[i] });
      }

      const deviationTotal = sumDeviation / this.signal.length;
      deviation = deviationA * deviationTotal;
    }

    return cov / deviation;
  }

  async dc() {
    return new Promise(resolve => {
      let sum = 0;
      const fft = new FFTReal(this.signal);
      for (let i = 0; i < fft.length; ++i) {
        sum += Math.pow(fft[i].re, 2);
      }
      resolve((sum /= fft.length));
    });
  }

  async energy(options = { fft: null }) {
    return new Promise(resolve => {
      let sum = 0;
      const fft = options.fft === null ? new FFTReal(this.signal) : options.fft;
      for (let i = 0; i < fft.length; ++i) {
        sum += Math.pow(fft[i].re, 2) + Math.pow(fft[i].im, 2);
      }
      resolve((sum /= fft.length));
    });
  }

  async entropy() {
    let sum = 0;
    const fft = new FFTReal(this.signal);
    const energy = await this.energy({ fft });

    for (let i = 0; i < fft.length; ++i) {
      sum += (Math.pow(fft[i].re, 2) + Math.pow(fft[i].im, 2)) / (fft.length - energy);
    }

    return (sum *= Number(-1));
  }
}

export default Feature;
