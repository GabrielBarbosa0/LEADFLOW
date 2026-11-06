import { describe, expect, it } from 'vitest';
import { dashboardSummary, upcomingDateRange } from '../../src/utils/dashboard.js';

describe('dashboardSummary', () => {
  it('calculates conversion, ophthalmology, transport and payment indicators', () => {
    const records = [
      {
        appointmentDate: '2026-10-29', appointmentTime: '08:00', careRoute: 'ophthalmologist',
        examPaymentType: 'paid', examPaymentMethods: ['pix', 'cash'], productPaymentMethods: ['pix', 'credit-card'], needsTransport: true, transportSeats: 2, hasCompanion: true,
        birthDate: '1960-10-20', sex: 'female', pathologyIds: ['cataract', 'retinopathy'], interestId: 'complete-glasses',
        appointmentCancellationReason: 'client_withdrew'
      },
      {
        appointmentDate: '', appointmentTime: '', careRoute: 'optometrist',
        examPaymentType: 'courtesy', productPaymentMethods: ['cash'], needsTransport: false, birthDate: '1980-01-01',
        sex: 'male', pathologyIds: ['glaucoma'], interestId: 'frames', appointmentRescheduleReason: 'client_request'
      },
      {
        appointmentDate: '2026-11-10', appointmentTime: '09:00', careRoute: 'ophthalmologist',
        examPaymentMethod: 'debit-card', needsTransport: true, hasCompanion: false, birthDate: '2000-01-01',
        sex: 'female', pathologyIds: ['retinopathy'], interestId: 'complete-glasses', appointmentRescheduleReason: 'transport_issue'
      }
    ];

    const summary = dashboardSummary(records, records, new Date('2026-10-28T12:00:00-03:00'));

    expect(summary).toMatchObject({
      total: 3,
      scheduled: 2,
      appointmentRate: 67,
      awaitingAppointment: 1,
      ophthalmologist: 2,
      ophthalmologistRate: 67,
      transportClients: 2,
      transportSeats: 3,
      paidExams: 1,
      courtesyExams: 1,
      unspecifiedExams: 1,
      upcomingAppointments: 1,
      upcomingTransportClients: 1,
      upcomingTransportSeats: 2
    });
    expect(summary.clinicalRoutes.map(({ label, count }) => [label, count])).toEqual([
      ['Optometrista', 1],
      ['Oftalmologista', 2],
      ['Não informado', 0]
    ]);
    expect(summary.pathologies.map(({ label, count }) => [label, count])).toEqual([
      ['Retinopatia', 2],
      ['Catarata', 1],
      ['Glaucoma', 1]
    ]);
    expect(summary.ageRanges.map(({ label, count }) => [label, count])).toEqual([
      ['Até 39 anos', 1],
      ['40 a 54 anos', 1],
      ['55 a 64 anos', 0],
      ['65 anos ou mais', 1],
      ['Não informado', 0]
    ]);
    expect(summary.sexes.map(({ label, count }) => [label, count])).toEqual([
      ['Feminino', 2],
      ['Masculino', 1],
      ['Outro', 0],
      ['Não informado', 0]
    ]);
    expect(summary.cancellationReasons.map(({ label, count }) => [label, count])).toEqual([['Cliente desistiu', 1]]);
    expect(summary.rescheduleReasons.map(({ label, count }) => [label, count])).toEqual([
      ['Problema de transporte', 1],
      ['Solicitação do cliente', 1]
    ]);
    expect(summary.examPaymentMethods.map(({ id, count, percentage }) => [id, count, percentage])).toEqual(expect.arrayContaining([
      ['cash', 1, 33],
      ['pix', 1, 33],
      ['debit-card', 1, 33]
    ]));
    expect(summary.productPaymentMethods.map(({ id, count, percentage }) => [id, count, percentage])).toEqual(expect.arrayContaining([
      ['cash', 1, 33],
      ['pix', 1, 33],
      ['credit-card', 1, 33]
    ]));
    expect(summary.interests.map(({ label, count }) => [label, count])).toEqual([
      ['Óculos completo', 2],
      ['Armação', 1]
    ]);
    expect(summary.transportByDay).toEqual([
      { date: '2026-10-29', clients: 1, companions: 1, seats: 2 }
    ]);
  });

  it('uses seven calendar days including today and keeps future demand independent', () => {
    const upcomingRecords = [
      { appointmentDate: '2026-10-28', appointmentTime: '08:00' },
      { appointmentDate: '2026-11-03', appointmentTime: '09:00', needsTransport: true, hasCompanion: true },
      { appointmentDate: '2026-11-04', appointmentTime: '10:00' }
    ];

    expect(upcomingDateRange(new Date('2026-10-28T23:30:00-03:00'))).toEqual({
      startDate: '2026-10-28',
      endDate: '2026-11-03'
    });
    expect(dashboardSummary([], upcomingRecords, new Date('2026-10-28T23:30:00-03:00'))).toMatchObject({
      upcomingAppointments: 2,
      upcomingTransportClients: 1,
      upcomingTransportSeats: 2
    });
  });
});
