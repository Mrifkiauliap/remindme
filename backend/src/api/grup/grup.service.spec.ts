import { Test, TestingModule } from '@nestjs/testing';
import { GrupService } from './grup.service';

describe('GrupService', () => {
  let service: GrupService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GrupService],
    }).compile();

    service = module.get<GrupService>(GrupService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
