import { GraphQLScalarType, Kind } from 'graphql';

export const jsonScalarTypeDefs = 'scalar JSON';

export const jsonScalarResolvers = {
  JSON: new GraphQLScalarType({
    name: 'JSON',
    description: 'Arbitrary JSON value.',
    serialize: (value) => value,
    parseValue: (value) => value,
    parseLiteral(ast) {
      return parseLiteralValue(ast);
    },
  }),
};

function parseLiteralValue(ast) {
  switch (ast.kind) {
    case Kind.STRING:
    case Kind.BOOLEAN:
      return ast.value;
    case Kind.INT:
    case Kind.FLOAT:
      return Number(ast.value);
    case Kind.OBJECT:
      return Object.fromEntries(ast.fields.map((field) => [field.name.value, parseLiteralValue(field.value)]));
    case Kind.LIST:
      return ast.values.map((value) => parseLiteralValue(value));
    case Kind.NULL:
      return null;
    default:
      return null;
  }
}
