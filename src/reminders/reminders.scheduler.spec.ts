import { SchedulerRegistry } from '@nestjs/schedule';
import { RemindersScheduler } from './reminders.scheduler';

describe('RemindersScheduler', () => {
  let scheduler: RemindersScheduler;
  let remindersService: {
    dispatchTomorrowRemindersIfDue: jest.Mock;
    backfillMissedTomorrowReminders: jest.Mock;
    processDueReminders: jest.Mock;
    recoverStuckProcessingReminders: jest.Mock;
  };
  let configService: { get: jest.Mock };
  let schedulerRegistry: {
    addCronJob: jest.Mock;
    deleteCronJob: jest.Mock;
    getCronJob: jest.Mock;
    doesExist: jest.Mock;
  };

  beforeEach(() => {
    remindersService = {
      dispatchTomorrowRemindersIfDue: jest.fn(),
      backfillMissedTomorrowReminders: jest.fn(),
      processDueReminders: jest.fn(),
      recoverStuckProcessingReminders: jest.fn(),
    };

    configService = {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        const values: Record<string, unknown> = {
          REMINDERS_TIMEZONE: 'America/Caracas',
          REMINDERS_DISPATCH_HOUR: 17,
          REMINDERS_DISPATCH_MINUTE: 0,
          REMINDERS_BACKFILL_CRON: '0 0,30 * * * *',
          REMINDERS_PROCESSOR_CRON: '15 0,30 * * * *',
          REMINDERS_RECOVERY_CRON: '45 0,30 * * * *',
        };

        return key in values ? values[key] : defaultValue;
      }),
    };

    schedulerRegistry = {
      addCronJob: jest.fn(),
      deleteCronJob: jest.fn(),
      getCronJob: jest.fn(() => ({
        stop: jest.fn(),
      })),
      doesExist: jest.fn(() => false),
    };

    scheduler = new RemindersScheduler(
      remindersService as never,
      configService as never,
      schedulerRegistry as unknown as SchedulerRegistry,
    );
  });

  it('registers the dispatch, backfill, processor and recovery cron jobs on module init', () => {
    const registerSpy = jest
      .spyOn(scheduler as any, 'registerCronJob')
      .mockImplementation(() => undefined);

    scheduler.onModuleInit();

    expect(registerSpy).toHaveBeenCalledTimes(4);
    expect(registerSpy).toHaveBeenNthCalledWith(
      1,
      'booking-reminders-dispatch',
      '0 0 17 * * *',
      expect.any(Function),
    );
    expect(registerSpy).toHaveBeenNthCalledWith(
      2,
      'booking-reminders-backfill',
      '0 0,30 * * * *',
      expect.any(Function),
    );
    expect(registerSpy).toHaveBeenNthCalledWith(
      3,
      'booking-reminders-processor',
      '15 0,30 * * * *',
      expect.any(Function),
    );
    expect(registerSpy).toHaveBeenNthCalledWith(
      4,
      'booking-reminders-recovery',
      '45 0,30 * * * *',
      expect.any(Function),
    );
  });

  it('cleans up registered cron jobs on module destroy', () => {
    const stop = jest.fn();
    schedulerRegistry.doesExist.mockReturnValue(true);
    schedulerRegistry.getCronJob.mockReturnValue({ stop });

    scheduler.onModuleDestroy();

    expect(stop).toHaveBeenCalledTimes(4);
    expect(schedulerRegistry.deleteCronJob).toHaveBeenCalledTimes(4);
  });

  it('delegates the daily dispatch tick to the reminders service', async () => {
    await scheduler.handleDispatchTick();
    expect(remindersService.dispatchTomorrowRemindersIfDue).toHaveBeenCalledTimes(1);
  });

  it('delegates the backfill tick to the reminders service', async () => {
    await scheduler.handleBackfillTick();
    expect(remindersService.backfillMissedTomorrowReminders).toHaveBeenCalledTimes(1);
  });

  it('delegates the processing tick to the reminders service', async () => {
    await scheduler.handleProcessingTick();
    expect(remindersService.processDueReminders).toHaveBeenCalledTimes(1);
  });

  it('delegates the recovery tick to the reminders service', async () => {
    await scheduler.handleRecoveryTick();
    expect(remindersService.recoverStuckProcessingReminders).toHaveBeenCalledTimes(1);
  });
});
