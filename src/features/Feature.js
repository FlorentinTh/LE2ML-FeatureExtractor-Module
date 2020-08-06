class Feature {
  constructor() {
    this.result = {};
  }

  async average(attribute, signal) {
    if (!(attribute.constructor === String)) {
      throw new Error('Expected type for attribute signal is String.');
    }

    if (!(signal.constructor === Array)) {
      throw new Error('Expected type for argument signal is Array.');
    }

    let sum = 0;
    for (let i = 0; i < signal.length; ++i) {
      sum += signal[i];
    }

    this.setResult('average', attribute, sum / signal.length);
  }

  async averageTotal() {}
}

export default Feature;
