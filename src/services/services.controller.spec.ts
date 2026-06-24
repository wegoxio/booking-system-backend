import { Test, TestingModule } from '@nestjs/testing';
import { ServicesController } from './services.controller';

describe('ServicesController', () => {
  let controller: ServicesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ServicesController],
    })
      .useMocker(() => ({}))
      .compile();

    controller = module.get<ServicesController>(ServicesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
