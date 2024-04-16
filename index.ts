export const WEB_AUDIO_BLOCK_SIZE = 128;

/**
 * A custom hop worklet processor that buffers input of size `hopSize` and slowly releases `WEB_AUDIO_BLOCK_SIZE` audio chunks.
 *
 * ```ts
 * class MyCustomHopWorklet extends CustomHopWorkletProcessor {
 *      public constructor() {
 *          super(512, 1, 2); // 512 samples, 1 input, 2 channels
 *      }
 *
 *      public override processBuffered(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
 *          // Do stuff normally, but now the inputs and outputs are 512 samples long!
 *      }
 * }
 * ```
 */
export abstract class CustomHopWorkletProcessor extends AudioWorkletProcessor {
  private _hopSize: number;
  private _outputBuffers!: Float32Array[][];
  private _inputBuffers!: Float32Array[][];
  private _readPointer: number;
  private _writePointer: number;

  /**
   * @param hopSize The required hop size in samples. The default size for the web audio API is 128 samples.
   */
  public constructor(
    hopSize: number,
    inputCount: number = 0,
    channelCount: number = 0
  ) {
    super();
    this._hopSize = hopSize;
    this.setInputAndChannelCount(inputCount, channelCount);
    this._readPointer = hopSize;
    this._writePointer = 0;
  }

  /**
   * Set the input and channel count for the buffers. This destroys the previous buffers and create a new one.
   *
   * Meant to be used when you want to initialize somewhere else other than the constructor.
   */
  public setInputAndChannelCount(inputCount: number, channelCount: number) {
    this._inputBuffers = Array.from({ length: inputCount }, () =>
      Array.from({ length: channelCount }, () => {
        return new Float32Array(this._hopSize);
      })
    );

    this._outputBuffers = { ...this._inputBuffers };
  }

  public processBuffered(
    /**
     * Length === `this._hopSize`
     */
    inputs: Float32Array[][],
    /**
     * Length === `this._hopSizes`
     */
    outputs: Float32Array[][]
  ): boolean {
    throw new Error("Method not implemented.");
  }

  /**
   * The original `process` method from the audio worklet processor.
   *
   * Override this if you want the original `process` method to be called
   */
  public process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    this._inputBuffer(inputs);

    if (this._outputHasMore()) {
      this._outputShiftTo(outputs);
      return true;
    }

    if (!this._inputHasEnough()) {
      return true;
    }

    if (!this.processBuffered(this._inputBuffers, this._outputBuffers)) {
      return false;
    }

    this._resetPointers();
    this._outputShiftTo(outputs);
    return true;
  }

  private _outputShiftTo(outputs: Float32Array[][]) {
    for (let i = 0; i < outputs.length; i++) {
      for (let j = 0; j < outputs[i].length; j++) {
        outputs[i][j].set(
          this._outputBuffers[i][j].subarray(
            this._readPointer,
            this._readPointer + WEB_AUDIO_BLOCK_SIZE
          )
        );
      }
    }

    this._readPointer += WEB_AUDIO_BLOCK_SIZE;
  }

  private _inputBuffer(input: Float32Array[][]) {
    for (let i = 0; i < this._inputBuffers.length; i++) {
      for (let j = 0; j < this._inputBuffers[i].length; j++) {
        this._inputBuffers[i][j].set(input[i][j]);
      }
    }

    this._writePointer += WEB_AUDIO_BLOCK_SIZE;
  }

  private _inputHasEnough() {
    return this._writePointer >= this._hopSize;
  }

  private _outputHasMore() {
    return this._readPointer < this._hopSize;
  }

  private _resetPointers() {
    this._readPointer = 0;
    this._writePointer = 0;
  }
}
