import { describe, expect, it } from 'vitest';
import { createLeadsCsv } from '../../src/utils/lead-export.js';

describe('createLeadsCsv', () => {
  it('exports one lead with a UTF-8 BOM and semicolon separators', () => {
    const csv = createLeadsCsv([{
      id: 'lead-001',
      capturedAtClient: '2026-09-28T12:00:00.000Z',
      fullName: 'Cliente Exemplo',
      preferredName: 'Cliente',
      birthDate: '1985-04-12',
      sex: 'female',
      phone: '+5581999991234',
      phoneSearch: '81999991234',
      customerRg: '12.345.678-X',
      interestLabel: 'Armação',
      ametropiaLabels: ['Miopia', 'Astigmatismo'],
      pathologyLabels: ['Glaucoma', 'Pressao alta'],
      street: 'Rua das Flores',
      streetNumber: 'S/N',
      neighborhood: 'Centro',
      city: 'Recife',
      state: 'PE',
      addressReference: 'Ao lado da praça',
      storeId: 'loja-06',
      capturedByName: 'Captador Teste',
      capturedByUid: 'captor-001',
      appointmentDate: '2026-10-02',
      appointmentTime: '14:30',
      careRoute: 'ophthalmologist',
      examPaymentType: 'paid',
      examPaymentMethods: ['pix', 'credit-card'],
      examPrice: 200,
      appointmentAttendance: 'attended',
      source: 'street',
      notes: 'Contato pela manhã'
    }]);

    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"ID do lead";"Nome do cliente"');
    expect(csv).toContain('"lead-001";"Cliente Exemplo";"Cliente";"(81) 99999-1234"');
    expect(csv).toContain('"Data de nascimento";"Idade atual"');
    expect(csv).toContain('"Telefone";"RG"');
    expect(csv).toContain('"12.345.678-X"');
    expect(csv).toContain('"12/04/1985"');
    expect(csv).toContain('"Sexo"');
    expect(csv).toContain('"Feminino"');
    expect(csv).toContain('"Loja 06"');
    expect(csv).toContain('"02/10/2026";"14:30"');
    expect(csv).toContain('"Compareceu?"');
    expect(csv).toContain('"Tipo do exame";"Forma de pagamento do exame";"Nome do pai (carnê)"');
    expect(csv).toContain('"Pago";"Pix + Cartão de crédito";"";"";"";"200"');
    expect(csv).toContain('"14:30";"Pago";"Pix + Cartão de crédito";"";"";"";"200";"Sim"');
    expect(csv).toContain('"Captação em campo"');
    expect(csv).toContain('"Ametropias"');
    expect(csv).toContain('"Miopia, Astigmatismo"');
    expect(csv).toContain('"Patologias e condições de saúde"');
    expect(csv).toContain('"Glaucoma, Pressao alta"');
    expect(csv).toContain('"Rua"');
    expect(csv).toContain('"Rua das Flores"');
    expect(csv).toContain('"Número"');
    expect(csv).toContain('"S/N"');
    expect(csv).toContain('"Referência do endereço"');
    expect(csv).toContain('"Ao lado da praça"');
    expect(csv).not.toContain('Consentimento');
  });

  it('escapes quotes and protects spreadsheet formulas', () => {
    const csv = createLeadsCsv([{
      fullName: '=IMPORTXML("url")',
      notes: 'Cliente disse "sim"'
    }]);

    expect(csv).toContain('"\'=IMPORTXML(""url"")"');
    expect(csv).toContain('"Cliente disse ""sim"""');
  });
});
