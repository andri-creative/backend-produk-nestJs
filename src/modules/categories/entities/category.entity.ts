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
  HasMany,
  Model,
  PrimaryKey,
  Table,
  Unique,
} from 'sequelize-typescript';

@Table({
  tableName: 'categories',
  underscored: true,
  timestamps: true,
})
export class Category extends Model<InferAttributes<Category>, InferCreationAttributes<Category>> {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: CreationOptional<string>;

  @ForeignKey(() => Category)
  @Column({ type: DataType.UUID, allowNull: true })
  declare parentId: CreationOptional<string | null>;

  @Column({ type: DataType.STRING(100), allowNull: false })
  declare name: string;

  @Unique
  @Column({ type: DataType.STRING(100), allowNull: false })
  declare slug: string;

  @Column({ type: DataType.STRING(50), allowNull: true })
  declare icon: CreationOptional<string | null>;

  @Column({ type: DataType.TEXT, allowNull: true })
  declare description: CreationOptional<string | null>;

  @Default(0)
  @Column({ type: DataType.INTEGER, allowNull: false })
  declare sortOrder: CreationOptional<number>;

  @Default(true)
  @Column({ type: DataType.BOOLEAN, allowNull: false })
  declare isActive: CreationOptional<boolean>;

  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  @BelongsTo(() => Category)
  declare parent?: NonAttribute<Category>;

  @HasMany(() => Category)
  declare children?: NonAttribute<Category[]>;
}
