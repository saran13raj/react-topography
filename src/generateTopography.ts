import { promises as fs } from "fs";
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
  props: string[];
}

interface TopographyNode {
  name: string;
  children: TopographyNode[];
  file: string | null;
  uses: string[];
  props: string[];
}

interface FileParseResult {
  filePath: string;
  components: { name: string; props: string[] }[];
  usedComponents: string[];
  routes: Route[];
}

async function parseFile(filePath: string): Promise<FileParseResult> {
  const code = await fs.readFile(filePath, "utf-8");
  const ast = parse(code, {
    sourceType: "module",
    plugins: ["jsx", "typescript"],
  });

  const components: { name: string; props: string[] }[] = [];
  const usedComponents = new Set<string>();
  const routes: Route[] = [];

  try {
    // @ts-ignore
    traverse.default(ast, {
      FunctionDeclaration({ node }: { node: any }) {
        if (node.id && /^[A-Z]/.test(node.id.name)) {
          const props =
            node.params[0]?.properties?.map((prop: any) => prop?.key?.name) ||
            [];
          components.push({ name: node.id.name, props });
        }
      },
      VariableDeclarator({ node }: { node: any }) {
        if (
          node.id.name &&
          /^[A-Z]/.test(node.id.name) &&
          (node.init?.type === "ArrowFunctionExpression" ||
            node.init?.type === "FunctionExpression")
        ) {
          const props =
            node.init.params[0]?.properties?.map(
              (prop: any) => prop.key.name,
            ) || [];
          components.push({ name: node.id.name, props });
        }
      },
      ClassDeclaration({ node }: { node: any }) {
        if (node.id && /^[A-Z]/.test(node.id.name)) {
          let props: string[] = [];
          // Look for constructor to find props
          const constructor = node.body.body.find(
            (method: any) => method.kind === "constructor",
          );
          if (constructor?.value?.params[0]?.properties) {
            props = constructor.value.params[0].properties.map(
              (prop: any) => prop.key.name,
            );
          }
          components.push({ name: node.id.name, props });
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
  } catch (e: any) {
    console.log("Error:::", e);
  }
  return {
    filePath,
    components,
    usedComponents: Array.from(usedComponents),
    routes,
  };
}

export default async function generateTopography(
  srcDir: string,
): Promise<TopographyNode> {
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
      componentMap.set(comp.name, {
        definedIn: filePath,
        uses: usedComponents,
        routes: routes.filter((r) => r.component === comp.name),
        props: comp.props,
      });
    });
  }

  const topography: TopographyNode = {
    name: "App",
    children: [],
    file: appFile,
    uses: [],
    props: [],
  };
  const visited = new Set<string>();

  function buildTree(nodeName: string, parentNode: TopographyNode) {
    if (visited.has(nodeName)) return;
    visited.add(nodeName);

    const componentInfo = componentMap.get(nodeName);
    if (!componentInfo) return;

    componentInfo.routes.forEach((route) => {
      const routeNode: TopographyNode = {
        name: `Route: ${route.path}`,
        children: [],
        file: componentInfo.definedIn,
        props: componentInfo.props,
        uses: componentInfo.uses,
      };
      parentNode.children.push(routeNode);
      buildTree(route.component, routeNode);
    });

    componentInfo.uses.forEach((comp) => {
      if (componentMap.has(comp) && comp !== nodeName) {
        const childNode: TopographyNode = {
          name: comp,
          children: [],
          file: componentMap.get(comp)!.definedIn,
          props: componentInfo.props,
          uses: componentInfo.uses,
        };
        parentNode.children.push(childNode);
        buildTree(comp, childNode);
      }
    });
  }

  if (componentMap.has("App")) {
    buildTree("App", topography);
  }

  return topography;
}
