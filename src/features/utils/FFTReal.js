import ezfft from 'ezfft';
import { complex } from 'mathjs';

class FFTReal {
  constructor(signal) {
    this.signal = signal;
    return this.compute();
  }

  compute() {
    const result = [];
    const fft = ezfft.fft(this.signal, this.signal.length).frequency;

    for (let i = 0; i < fft.realPart.length; ++i) {
      result.push(complex({ re: fft.realPart[i], im: fft.imagPart[i] }));
    }

    return result;
  }
}

export default FFTReal;
