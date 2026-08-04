import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/http/app.js';

const app = createApp();

describe('GET /health', () => {
  it('returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('POST /pop/api/exposure-decision', () => {
  it('200 with advisory result for a valid breach', async () => {
    const res = await request(app)
      .post('/pop/api/exposure-decision')
      .send({
        caseId: 'EXP-30412',
        exceptionType: 'Credit Exposure',
        limits: { dLimitValue: 50000, cLimitValue: 450000, tempValue: 25000, exposureValue: 550000 },
        transactions: [{ type: 'Credit', tc: '27', amount: 180000 }],
      });
    expect(res.status).toBe(200);
    expect(res.body.limitBreached).toBe('YES');
    expect(res.body.recommendation).toBe('ROUTE-UW');
    expect(res.body.requiresHumanDecision).toBe(true);
  });

  it('200 INSUFFICIENT_DATA when business data missing (not a 400)', async () => {
    const res = await request(app)
      .post('/pop/api/exposure-decision')
      .send({ caseId: 'EXP-1' });
    expect(res.status).toBe(200);
    expect(res.body.limitBreached).toBe('INSUFFICIENT_DATA');
    expect(Array.isArray(res.body.missingDataFields)).toBe(true);
  });

  it('400 when caseId missing', async () => {
    const res = await request(app).post('/pop/api/exposure-decision').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('caseId');
  });

  it('400 when a field has the wrong type', async () => {
    const res = await request(app)
      .post('/pop/api/exposure-decision')
      .send({ caseId: 'X', limits: { exposureValue: 'lots' } });
    expect(res.status).toBe(400);
  });

  it('400 on malformed JSON', async () => {
    const res = await request(app)
      .post('/pop/api/exposure-decision')
      .set('Content-Type', 'application/json')
      .send('{ not json ');
    expect(res.status).toBe(400);
  });
});

describe('POST /pop/api/threshold-determination', () => {
  it('200 with routing determination', async () => {
    const res = await request(app)
      .post('/pop/api/threshold-determination')
      .send({
        caseId: 'EXP-30412',
        exceptionType: 'Credit Exposure',
        limits: { dLimitValue: 50000, cLimitValue: 450000, tempValue: 25000, exposureValue: 550000 },
        transactions: [{ type: 'Credit', tc: '27', amount: 180000 }],
      });
    expect(res.status).toBe(200);
    expect(res.body.determination).toBe('EXCEEDS_THRESHOLD');
    expect(res.body.route).toBe('RBOPCG_ESCALATION');
  });

  it('400 when required limits are missing', async () => {
    const res = await request(app)
      .post('/pop/api/threshold-determination')
      .send({ caseId: 'EXP-1', limits: { dLimitValue: 1 } });
    expect(res.status).toBe(400);
  });
});

describe('unknown route', () => {
  it('404', async () => {
    const res = await request(app).get('/nope');
    expect(res.status).toBe(404);
  });
});
