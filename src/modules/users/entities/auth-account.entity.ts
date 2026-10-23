import type {
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
  NonAttribute,
} from 'sequelize';
import {
  BelongsTo,
  Column,
  DataType,
  Default,
  ForeignKey,
  Model,
  PrimaryKey,
  Table,
} from 'sequelize-typescript';
import { User } from './user.entity';

@Table({
  tableName: 'auth_accounts',
  underscored: true,
  timestamps: true,
  indexes: [{ unique: true, fields: ['provider', 'provider_account_id'] }],
})
export class AuthAccount extends Model<
  InferAttributes<AuthAccount>,
  InferCreationAttributes<AuthAccount>
> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: CreationOptional<string>;

  @ForeignKey(() => User)
  @Column({ type: DataType.UUID, allowNull: false })
  declare userId: string;

  @Column({ type: DataType.STRING(50), allowNull: false })
  declare provider: string;

  @Column({ type: DataType.STRING(255), allowNull: false })
  declare providerAccountId: string;

  @Column({ type: DataType.STRING(255), allowNull: false })
  declare email: string;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare avatarUrl: CreationOptional<string | null>;

  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  @BelongsTo(() => User)
  declare user?: NonAttribute<User>;
}
