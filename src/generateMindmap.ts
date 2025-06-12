import { promises as fs } from "fs";
// import * as path from "path";
import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import { globSync } from "glob";

interface Route {
  path: string;
  component: string;
}

interface ComponentInfo {
  definedIn: string;
  uses: string[];
  routes: Route[];
}

interface MindmapNode {
  name: string;
  children: MindmapNode[];
  file: string | null;
}

interface FileParseResult {
  filePath: string;
  components: string[];
  usedComponents: string[];
  routes: Route[];
}

async function parseFile(filePath: string): Promise<FileParseResult> {
  const code = await fs.readFile(filePath, "utf-8");
  const ast = parse(code, {
    sourceType: "module",
    plugins: ["jsx", "typescript"],
  });

  const components = new Set<string>();
  const usedComponents = new Set<string>();
  const routes: Route[] = [];

  // @ts-ignore
  traverse.default(ast, {
    FunctionDeclaration({ node }: { node: any }) {
      if (node.id && /^[A-Z]/.test(node.id.name)) {
        components.add(node.id.name);
      }
    },
    VariableDeclarator({ node }: { node: any }) {
      if (
        node.id.name &&
        /^[A-Z]/.test(node.id.name) &&
        (node.init?.type === "ArrowFunctionExpression" ||
          node.init?.type === "FunctionExpression")
      ) {
        components.add(node.id.name);
      }
    },
    ClassDeclaration({ node }: { node: any }) {
      if (node.id && /^[A-Z]/.test(node.id.name)) {
        components.add(node.id.name);
      }
    },
    JSXElement({ node }: { node: any }) {
      const componentName = node.openingElement.name.name;
      if (componentName && /^[A-Z]/.test(componentName)) {
        usedComponents.add(componentName);
      }
      if (componentName === "Route") {
        let pathAttr: string | undefined, componentAttr: string | undefined;
        node.openingElement.attributes.forEach((attr: any) => {
          if (attr.name.name === "path") {
            pathAttr = attr.value?.value || "dynamic";
          }
          if (attr.name.name === "component") {
            if (attr.value.type === "JSXExpressionContainer") {
              componentAttr = attr.value.expression.name;
            }
          }
        });
        if (pathAttr && componentAttr) {
          routes.push({ path: pathAttr, component: componentAttr });
        }
      }
    },
  });

  return {
    filePath,
    components: Array.from(components),
    usedComponents: Array.from(usedComponents),
    routes,
  };
}

export default async function generateMindmap(
  srcDir: string,
): Promise<MindmapNode> {
  const files = globSync(`${srcDir}/**/*.{js,jsx,ts,tsx}`);
  const componentMap = new Map<string, ComponentInfo>();
  let appFile: string | null = null;
  for (const file of files) {
    const { filePath, components, usedComponents, routes } =
      await parseFile(file);
    if (filePath.includes("App.") || filePath.includes("app.")) {
      appFile = filePath;
    }
    components.forEach((comp) => {
      componentMap.set(comp, {
        definedIn: filePath,
        uses: usedComponents,
        routes: routes.filter((r) => r.component === comp),
      });
    });
  }

  const mindmap: MindmapNode = { name: "App", children: [], file: appFile };
  const visited = new Set<string>();

  function buildTree(nodeName: string, parentNode: MindmapNode) {
    if (visited.has(nodeName)) return;
    visited.add(nodeName);

    const componentInfo = componentMap.get(nodeName);
    if (!componentInfo) return;

    componentInfo.routes.forEach((route) => {
      const routeNode: MindmapNode = {
        name: `Route: ${route.path}`,
        children: [],
        file: componentInfo.definedIn,
      };
      parentNode.children.push(routeNode);
      buildTree(route.component, routeNode);
    });

    componentInfo.uses.forEach((comp) => {
      if (componentMap.has(comp) && comp !== nodeName) {
        const childNode: MindmapNode = {
          name: comp,
          children: [],
          file: componentMap.get(comp)!.definedIn,
        };
        parentNode.children.push(childNode);
        buildTree(comp, childNode);
      }
    });
  }

  if (componentMap.has("App")) {
    buildTree("App", mindmap);
  }

  return mindmap;
}
