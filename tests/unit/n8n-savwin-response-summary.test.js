import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const code = readFileSync(
  new URL('../../docs/n8n/resumir-retorno-dry-run.js', import.meta.url),
  'utf8'
);

function run(items) {
  const execute = new Function('$input', code);
  return execute({ all: () => items });
}

function validResponse(overrides = {}) {
  return {
    json: {
      ok: true,
      mode: 'dry_run',
      summary: {
        salesReceived: 4,
        matched: 0,
        matchedSameStore: 0,
        noLead: 3,
        ambiguous: 0,
        missingCpf: 1,
        invalidCpf: 0,
        saleBeforeCapture: 0,
        outsideWindow: 0,
        reconciliationDivergent: 0
      },
      results: [
        { saleKey: '0004:1', status: 'no_lead' },
        { saleKey: '0004:2', status: 'missing_cpf' },
        { saleKey: '0004:3', status: 'no_lead' },
        { saleKey: '0004:4', status: 'no_lead' }
      ],
      ...overrides
    }
  };
}

describe('resumir retorno do dry-run no n8n', () => {
  it('produz apenas contagens seguras', () => {
    const [output] = run([validResponse()]);

    expect(output.json).toMatchObject({
      responseAccepted: true,
      salesReceived: 4,
      eligibleMatches: 0,
      unmatchedSales: 4,
      noLead: 3,
      missingCpf: 1,
      containsIndividualResults: false
    });
    expect(output.json.statusCounts).toEqual({ no_lead: 3, missing_cpf: 1 });
    expect(JSON.stringify(output)).not.toContain('0004:1');
    expect(output.json).not.toHaveProperty('results');
  });

  it('recusa resposta fora do modo dry-run', () => {
    expect(() => run([validResponse({ mode: 'apply' })])).toThrow(/dry-run valido/);
  });

  it('recusa quantidade divergente e status desconhecido', () => {
    expect(() => run([validResponse({ results: [] })])).toThrow(/quantidade/);
    expect(() => run([validResponse({
      results: [
        { status: 'unknown' },
        { status: 'no_lead' },
        { status: 'no_lead' },
        { status: 'missing_cpf' }
      ]
    })])).toThrow(/status desconhecido/);
  });
});
