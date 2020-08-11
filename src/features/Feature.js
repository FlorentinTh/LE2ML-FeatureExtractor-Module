class Feature {
  constructor(signal) {
    this.signal = signal;
  }

  async compute(label) {
    if (label === 'average') {
      return await this.average();
    } else if (label === 'std_dev') {
      return await this.deviation();
    } else if (label === 'normal_skewness') {
      return await this.skewness({ adjusted: false });
    } else if (label === 'adjusted_skewness') {
      return await this.skewness({ adjusted: true });
    } else if (label === 'normal_kurtosis') {
      return await this.kurtosis({ adjusted: false });
    } else if (label === 'adjusted_kurtosis') {
      return await this.kurtosis({ adjusted: true });
    } else if (label === 'zero_crossing_rate') {
      return await this.zeroCrossingRate();
    } else {
      throw new Error('Feature function does not exist');
    }
  }

  async average() {
    return new Promise(resolve => {
      let sum = 0;
      for (let i = 0; i < this.signal.length; ++i) {
        sum += Number(this.signal[i]);
      }

      resolve(Number(sum / this.signal.length));
    });
  }

  async deviation() {
    const average = await this.average();

    return new Promise(resolve => {
      let sum = 0;
      for (let i = 0; i < this.signal.length; ++i) {
        sum += Math.pow(Number(this.signal[i]) - average, 2);
      }
      resolve(Math.sqrt(sum / this.signal.length));
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
}

export default Feature;
