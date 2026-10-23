import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard, type JwtPayload } from '../../core/auth/jwt-auth.guard';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;

  const usersService = {
    getMe: jest.fn(),
    updateProfile: jest.fn(),
    listAccounts: jest.fn(),
  };

  const currentUser: JwtPayload = {
    sub: 'user-1',
    email: 'andri@example.com',
    role: 'user',
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: usersService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should return current user detail on GET /users/me', async () => {
    const detail = {
      id: 'user-1',
      name: 'Andri',
      email: 'andri@example.com',
      role: 'user' as const,
      isActive: true,
      emailVerifiedAt: null,
      profile: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    usersService.getMe.mockResolvedValue(detail);

    await expect(controller.getMe(currentUser)).resolves.toEqual(detail);
    expect(usersService.getMe).toHaveBeenCalledWith('user-1');
  });

  it('should update profile on PATCH /users/me/profile', async () => {
    const dto = { displayName: 'Andri Baru' };
    const profile = {
      id: 'profile-1',
      userId: 'user-1',
      displayName: 'Andri Baru',
      phone: null,
      bio: null,
      avatarUrl: null,
      location: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    usersService.updateProfile.mockResolvedValue(profile);

    await expect(controller.updateProfile(currentUser, dto)).resolves.toEqual(profile);
    expect(usersService.updateProfile).toHaveBeenCalledWith('user-1', dto);
  });

  it('should list connected accounts on GET /users/me/accounts', async () => {
    const accounts = [
      {
        id: 'account-1',
        provider: 'local',
        providerAccountId: 'andri@example.com',
        email: 'andri@example.com',
        avatarUrl: null,
        createdAt: new Date(),
      },
    ];
    usersService.listAccounts.mockResolvedValue(accounts);

    await expect(controller.listAccounts(currentUser)).resolves.toEqual(accounts);
    expect(usersService.listAccounts).toHaveBeenCalledWith('user-1');
  });
});
