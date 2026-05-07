import { Test, TestingModule } from '@nestjs/testing';
import { JadwalMatakuliahService } from './jadwal-matakuliah.service';

describe('JadwalMatakuliahService', () => {
  let service: JadwalMatakuliahService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [JadwalMatakuliahService],
    }).compile();

    service = module.get<JadwalMatakuliahService>(JadwalMatakuliahService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
