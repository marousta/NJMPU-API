// Typescript compatible version of https://www.npmjs.com/package/exif-be-gone
import { Transform, TransformOptions, TransformCallback } from 'stream';

export class ExifTransformer extends Transform {
	private readonly app1Marker = Buffer.from('ffe1', 'hex');
	private readonly exifMarker = Buffer.from('457869660000', 'hex'); // Exif\0\0
	private readonly xmpMarker = Buffer.from('http://ns.adobe.com/xap', 'utf-8');
	private readonly flirMarker = Buffer.from('FLIR', 'utf-8');
	private readonly maxMarkerLength = Math.max(
		this.exifMarker.length,
		this.xmpMarker.length,
		this.flirMarker.length
	);

	remainingBytes?: number;
	pending: Array<Buffer>;

	constructor(options?: TransformOptions) {
		super(options);
		this.remainingBytes = undefined;
		this.pending = [];
	}

	_transform(chunk: any, _: string, callback: TransformCallback) {
		this._scrub(false, chunk);
		callback();
	}

	_final(callback: TransformCallback) {
		while (this.pending.length !== 0) {
			this._scrub(true);
		}
		callback();
	}

	_scrub(atEnd: Boolean, chunk?: Buffer) {
		let pendingChunk = chunk
			? Buffer.concat([...this.pending, chunk])
			: Buffer.concat(this.pending);
		// currently haven't detected an app1 marker
		if (this.remainingBytes === undefined) {
			const app1Start = pendingChunk.indexOf(this.app1Marker);
			// no app1 in the current pendingChunk
			if (app1Start === -1) {
				// if last byte is ff, wait for more
				if (!atEnd && pendingChunk[pendingChunk.length - 1] === this.app1Marker[0]) {
					if (chunk) this.pending.push(chunk);
					return;
				}
			} else {
				// there is an app1, but not enough data to read to exif marker
				// so defer
				if (app1Start + this.maxMarkerLength + 4 > pendingChunk.length) {
					if (atEnd) {
						this.push(pendingChunk);
						this.pending.length = 0;
					} else if (chunk) {
						this.pending.push(chunk);
					}
					return;
					// we have enough, so lets read the length
				} else {
					const candidateMarker = pendingChunk.slice(
						app1Start + 4,
						app1Start + this.maxMarkerLength + 4
					);
					if (
						this.exifMarker.compare(candidateMarker, 0, this.exifMarker.length) === 0 ||
						this.xmpMarker.compare(candidateMarker, 0, this.xmpMarker.length) === 0 ||
						this.flirMarker.compare(candidateMarker, 0, this.flirMarker.length) === 0
					) {
						// we add 2 to the remainingBytes to account for the app1 marker
						this.remainingBytes = pendingChunk.readUInt16BE(app1Start + 2) + 2;
						this.push(pendingChunk.slice(0, app1Start));
						pendingChunk = pendingChunk.slice(app1Start);
					}
				}
			}
		}

		// we have successfully read an app1/exif marker, so we can remove data
		if (this.remainingBytes !== undefined && this.remainingBytes !== 0) {
			// there is more data than we want to remove, so we only remove up to remainingBytes
			if (pendingChunk.length >= this.remainingBytes) {
				const remainingBuffer = pendingChunk.slice(this.remainingBytes);
				this.pending = remainingBuffer.length !== 0 ? [remainingBuffer] : [];
				this.remainingBytes = undefined;
				// this chunk is too large, remove everything
			} else {
				this.remainingBytes -= pendingChunk.length;
				this.pending.length = 0;
			}
		} else {
			// push this chunk
			this.push(pendingChunk);
			this.remainingBytes = undefined;
			this.pending.length = 0;
		}
	}
}
