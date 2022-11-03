import { Injectable, NestMiddleware } from '@nestjs/common';
import * as responseTime from 'response-time';
import { FastifyRequest, FastifyReply } from 'fastify';

@Injectable()
export class ResponseTimeMiddleware {
	private times: number[] = [];
	private nbr: number = 0;

	static readonly instance = new ResponseTimeMiddleware();

	private constructor() {}

	private calcAverage() {
		let total = 0;
		let length = this.times.length;
		for (let i = 0; i < length; ++i) {
			total += this.times[i];
		}
		return total / length;
	}

	private getTimes() {
		return {
			count: this.nbr,
			average: this.calcAverage() || -1,
			last: this.times[this.times.length - 1] || -1
		};
	}

	static fn(req: any, res: any, next: any) {
		const instance = ResponseTimeMiddleware.instance;

		// Exclude avatar upload from api speed counter
		if (req.url === '/api/avatar') {
			next();
			return;
		}

		// Set times in request object for accessing api speed counter in controller function
		if (req.url === '/api/stats') {
			req.headers['times'] = instance.getTimes();
			next();
			return;
		}

		responseTime((req, res, time) => {
			instance.times.push(time);
			instance.nbr++;

			if (instance.times.length > 1000) {
				instance.times.shift();
			}
		})(req, res, next);
	}
}
