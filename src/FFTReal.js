import ezfft from 'ezfft';
import Complex from 'complex';

class FFTReal {
  constructor(signal) {
    this.signal = signal;
    return this.compute();
  }

  compute() {
    const result = [];
    const fft = ezfft.fft(this.signal, this.signal.length).frequency;

    for (let i = 0; i < fft.realPart.length; ++i) {
      result.push(Complex.from(fft.realPart[i], fft.imagPart[i]).toString());
    }

    return result;
  }
}

export default FFTReal;
