import { Test, TestingModule } from '@nestjs/testing';
import { GrupController } from './grup.controller';
import { GrupService } from './grup.service';

describe('GrupController', () => {
  let controller: GrupController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GrupController],
      providers: [GrupService],
    }).compile();

    controller = module.get<GrupController>(GrupController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
