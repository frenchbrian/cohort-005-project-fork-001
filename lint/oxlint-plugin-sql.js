// Oxlint JS plugin: `sql/no-dynamic-raw`.
// `sql.raw()` skips Drizzle's parameter binding, so it accepts only text
// fixed at write time: a string literal, a template literal with no `${}`,
// or `+` joins of those. Dynamic values go through `sql\`...${value}\`` or
// the column helpers (`eq`, `like`, ...), which bind them as parameters.
import { definePlugin, defineRule } from "@oxlint/plugins";

function isStaticString(node) {
  if (node.type === "Literal") return typeof node.value === "string";
  if (node.type === "TemplateLiteral") return node.expressions.length === 0;
  if (node.type === "BinaryExpression" && node.operator === "+") {
    return isStaticString(node.left) && isStaticString(node.right);
  }
  return false;
}

function isSqlRaw(callee) {
  if (callee.type !== "MemberExpression") return false;
  if (callee.object.type !== "Identifier" || callee.object.name !== "sql") {
    return false;
  }
  const { property } = callee;
  if (!callee.computed) return property.name === "raw";
  return property.type === "Literal" && property.value === "raw";
}

const noDynamicRaw = defineRule({
  meta: {
    type: "problem",
    docs: { description: "Allow only static strings in sql.raw()" },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isSqlRaw(node.callee)) return;
        const [arg] = node.arguments;
        if (arg && isStaticString(arg)) return;
        context.report({
          node: arg ?? node,
          message:
            "sql.raw() takes only a static string. Bind dynamic values with sql`...${value}` or eq()/like().",
        });
      },
    };
  },
});

export default definePlugin({
  meta: { name: "sql" },
  rules: { "no-dynamic-raw": noDynamicRaw },
});
