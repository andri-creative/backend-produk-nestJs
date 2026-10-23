import type {
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
  NonAttribute,
} from 'sequelize';
import {
  Column,
  DataType,
  Default,
  HasMany,
  HasOne,
  Model,
  PrimaryKey,
  Table,
  Unique,
} from 'sequelize-typescript';
import { AuthAccount } from './auth-account.entity';
import { UserProfile } from './user-profile.entity';

export type UserRole = 'user' | 'admin';

@Table({
  tableName: 'users',
  underscored: true,
  timestamps: true,
})
export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: CreationOptional<string>;

  @Column({ type: DataType.STRING(100), allowNull: false })
  declare name: string;

  @Unique
  @Column({ type: DataType.STRING(255), allowNull: false })
  declare email: string;

  @Column({ type: DataType.STRING(255), allowNull: true })
  declare passwordHash: CreationOptional<string | null>;

  @Default('user')
  @Column({
    type: DataType.STRING(20),
    allowNull: false,
    validate: { isIn: [['user', 'admin']] },
  })
  declare role: CreationOptional<UserRole>;

  @Default(true)
  @Column({ type: DataType.BOOLEAN, allowNull: false })
  declare isActive: CreationOptional<boolean>;

  @Column({ type: DataType.DATE, allowNull: true })
  declare emailVerifiedAt: CreationOptional<Date | null>;

  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  @HasMany(() => AuthAccount)
  declare authAccounts?: NonAttribute<AuthAccount[]>;

  @HasOne(() => UserProfile)
  declare profile?: NonAttribute<UserProfile>;
}


