import { Test, TestingModule } from '@nestjs/testing';
import { JadwalMatakuliahController } from './jadwal-matakuliah.controller';
import { JadwalMatakuliahService } from './jadwal-matakuliah.service';

describe('JadwalMatakuliahController', () => {
  let controller: JadwalMatakuliahController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [JadwalMatakuliahController],
      providers: [JadwalMatakuliahService],
    }).compile();

    controller = module.get<JadwalMatakuliahController>(JadwalMatakuliahController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
