import FFTReal from './FFTReal';

// Test
function average(signal, axe) {
  let sum = 0;
  for (let i = 0; i < signal.length; i++) {
    sum += signal[i];
  }
  return sum / signal.length;
}

(async () => {
  // const signal = [1, 2, 3, 4, 5, 6];
  // const fft = new FFTReal(signal);
  // console.log(fft);
})();
