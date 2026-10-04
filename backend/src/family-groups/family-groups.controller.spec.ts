import { Test, TestingModule } from '@nestjs/testing';

import { FamilyGroupsService } from './family-groups.service.js';
import { FamilyGroupsController } from './family-groups.controller.js';
import { FamilyGroupsImportService } from './family-groups-import.service.js';

describe('FamilyGroupsController', () => {
  let controller: FamilyGroupsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FamilyGroupsController],
      providers: [
        {
          provide: FamilyGroupsService,
          useValue: {},
        },
        { provide: FamilyGroupsImportService, useValue: {} },
      ],
    }).compile();

    controller = module.get<FamilyGroupsController>(FamilyGroupsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
