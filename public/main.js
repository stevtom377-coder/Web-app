const baseFreqInput = document.getElementById('baseFreq');
const layersInput = document.getElementById('layers');
const widthInput = document.getElementById('width');
const modeSelect = document.getElementById('mode');
const baseFreqValue = document.getElementById('baseFreqValue');
const layersValue = document.getElementById('layersValue');
const widthValue = document.getElementById('widthValue');
const carrierValue = document.getElementById('carrierValue');
const modulationValue = document.getElementById('modulationValue');
const countValue = document.getElementById('countValue');
const frequencyList = document.getElementById('frequencyList');
const statusBadge = document.getElementById('statusBadge');

const presets = {
  cosmic: { base: 174, layers: 5, width: 6 },
  earth: { base: 128, layers: 4, width: 4 },
  solar: { base: 432, layers: 6, width: 8 }
};

const state = {
  baseFreq: Number(baseFreqInput.value),
  layers: Number(layersInput.value),
  width: Number(widthInput.value),
  sequence: [],
  audioContext: null,
  oscillators: [],
  gains: []
};

function formatHz(value) {
  return `${Math.round(value * 10) / 10} Hz`;
}

function syncLabels() {
  baseFreqValue.textContent = formatHz(state.baseFreq);
  layersValue.textContent = state.layers;
  widthValue.textContent = formatHz(state.width);
  carrierValue.textContent = formatHz(state.baseFreq);
  modulationValue.textContent = formatHz(state.width);
  countValue.textContent = state.layers;
}

function generateSequence() {
  const goldenRatio = 1.61803398875;
  const sequence = [];

  for (let index = 0; index < state.layers; index += 1) {
    const ratio = index === 0 ? 1 : Math.pow(goldenRatio, index);
    const tone = state.baseFreq * ratio;
    const tuned = tone + (index % 2 === 0 ? state.width : -state.width * 0.5) + ((index + 1) * state.width) / 8;
    sequence.push({
      id: index + 1,
      freq: Math.round(tuned * 10) / 10,
      phase: index % 2 === 0 ? 'resonant' : 'soft'
    });
  }

  state.sequence = sequence;
  return sequence;
}

function renderFrequencyList() {
  const sequence = generateSequence();
  frequencyList.innerHTML = '';

  sequence.forEach((entry) => {
    const item = document.createElement('li');
    item.className = `frequency-item ${entry.phase}`;
    item.innerHTML = `
      <span class="tone-name">Layer ${entry.id}</span>
      <strong>${formatHz(entry.freq)}</strong>
      <small>${entry.phase === 'resonant' ? 'Bright resonance' : 'Soft drift'}</small>
    `;
    frequencyList.appendChild(item);
  });

  syncLabels();
}

function stopPlayback() {
  state.oscillators.forEach((oscillator) => {
    try {
      oscillator.stop();
    } catch (error) {
      // ignore already stopped nodes
    }
    oscillator.disconnect();
  });

  state.gains.forEach((gainNode) => gainNode.disconnect());
  state.oscillators = [];
  state.gains = [];

  if (state.audioContext && state.audioContext.state !== 'closed') {
    state.audioContext.suspend();
  }

  statusBadge.textContent = 'Stopped';
  statusBadge.className = 'stopped';
}

function playResonance() {
  renderFrequencyList();
  stopPlayback();

  if (!state.audioContext) {
    state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  if (state.audioContext.state === 'suspended') {
    state.audioContext.resume();
  }

  const startTime = state.audioContext.currentTime;
  const masterGain = state.audioContext.createGain();
  masterGain.gain.value = 0.045;
  masterGain.connect(state.audioContext.destination);

  state.sequence.forEach((entry, index) => {
    const oscillator = state.audioContext.createOscillator();
    const gainNode = state.audioContext.createGain();
    const attackTime = 0.08 + index * 0.03;
    const releaseTime = 1.6 + index * 0.04;

    oscillator.type = index % 2 === 0 ? 'sine' : 'triangle';
    oscillator.frequency.setValueAtTime(entry.freq, startTime + attackTime);

    gainNode.gain.setValueAtTime(0.0001, startTime + attackTime);
    gainNode.gain.exponentialRampToValueAtTime(0.018, startTime + attackTime + 0.12);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + releaseTime);

    oscillator.connect(gainNode);
    gainNode.connect(masterGain);

    oscillator.start(startTime + attackTime);
    oscillator.stop(startTime + releaseTime);

    state.oscillators.push(oscillator);
    state.gains.push(gainNode);
  });

  statusBadge.textContent = 'Playing';
  statusBadge.className = 'playing';
}

function applyPreset(mode) {
  const preset = presets[mode];
  if (!preset) return;

  state.baseFreq = preset.base;
  state.layers = preset.layers;
  state.width = preset.width;
  baseFreqInput.value = preset.base;
  layersInput.value = preset.layers;
  widthInput.value = preset.width;
  renderFrequencyList();
}

[baseFreqInput, layersInput, widthInput].forEach((input) => {
  input.addEventListener('input', () => {
    state.baseFreq = Number(baseFreqInput.value);
    state.layers = Number(layersInput.value);
    state.width = Number(widthInput.value);
    syncLabels();
  });
});

modeSelect.addEventListener('change', (event) => {
  applyPreset(event.target.value);
});

document.getElementById('generateBtn').addEventListener('click', renderFrequencyList);
document.getElementById('playBtn').addEventListener('click', playResonance);
document.getElementById('stopBtn').addEventListener('click', stopPlayback);

window.addEventListener('beforeunload', stopPlayback);

renderFrequencyList();
