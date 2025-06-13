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
              (prop: any) => prop?.key?.name,
            ) || [];
          components.push({ name: node.id.name, props });
        }

        // Handle React.memo components
        if (
          node.id.name &&
          /^[A-Z]/.test(node.id.name) &&
          node.init?.type === "CallExpression" &&
          (node.init.callee.name === "memo" ||
            (node.init.callee.object?.name === "React" &&
              node.init.callee.property?.name === "memo"))
        ) {
          const wrappedExpression = node.init.arguments[0];
          let props: string[] = [];
          if (
            wrappedExpression?.type === "ArrowFunctionExpression" ||
            wrappedExpression?.type === "FunctionExpression"
          ) {
            props =
              wrappedExpression.params[0]?.properties?.map(
                (prop: any) => prop?.key?.name,
              ) || [];
          }
          components.push({ name: node.id.name, props });
        }

        // Handle React.lazy components
        if (
          node.id.name &&
          /^[A-Z]/.test(node.id.name) &&
          node.init?.type === "CallExpression" &&
          (node.init.callee.name === "lazy" ||
            (node.init.callee.object?.name === "React" &&
              node.init.callee.property?.name === "lazy"))
        ) {
          let componentName = node.id.name;
          // Extract the module name from the import() call
          if (
            node.init.arguments[0]?.type === "ArrowFunctionExpression" &&
            node.init.arguments[0].body?.type === "CallExpression" &&
            node.init.arguments[0].body.callee.type === "Import"
          ) {
            const importPath = node.init.arguments[0].body.arguments[0]?.value;
            if (importPath) {
              // Use the file name (without extension) as the component name
              componentName =
                importPath
                  .split("/")
                  .pop()
                  ?.replace(/\.[^/.]+$/, "") || node.id.name;
              // Capitalize the first letter to match component naming convention
              componentName =
                componentName.charAt(0).toUpperCase() + componentName.slice(1);
            }
          }
          // Lazy-loaded components typically don't have props defined in the lazy call
          components.push({ name: componentName, props: [] });
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
              (prop: any) => prop?.key?.name,
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
                componentAttr =
                  attr.value.expression.name ||
                  attr.value.expression.type === "JSXElement"
                    ? attr.value.expression.openingElement.name.name
                    : undefined;
              }
            }
          });
          if (pathAttr && componentAttr) {
            routes.push({ path: pathAttr, component: componentAttr });
          }
        }
      },

      ExportDefaultDeclaration({ node }: { node: any }) {
        let componentName = "DefaultComponent";
        let props: string[] = [];

        // Extract component name from file path (e.g., src/MyComponent.tsx -> MyComponent)
        const fileName = filePath
          .split("/")
          .pop()
          ?.replace(/\.[^/.]+$/, "");
        if (fileName) {
          componentName = fileName.charAt(0).toUpperCase() + fileName.slice(1);
        }

        if (
          node.declaration.type === "FunctionDeclaration" &&
          node.declaration.id?.name &&
          /^[A-Z]/.test(node.declaration.id.name)
        ) {
          componentName = node.declaration.id.name;
          props =
            node.declaration.params[0]?.properties?.map(
              (prop: any) => prop?.key?.name,
            ) || [];
        } else if (
          node.declaration.type === "ArrowFunctionExpression" &&
          /^[A-Z]/.test(componentName)
        ) {
          props =
            node.declaration.params[0]?.properties?.map(
              (prop: any) => prop?.key?.name,
            ) || [];
        } else if (
          node.declaration.type === "CallExpression" &&
          (node.declaration.callee.name === "memo" ||
            (node.declaration.callee.object?.name === "React" &&
              node.declaration.callee.property?.name === "memo"))
        ) {
          const wrappedExpression = node.declaration.arguments[0];
          if (
            wrappedExpression?.type === "ArrowFunctionExpression" ||
            wrappedExpression?.type === "FunctionExpression"
          ) {
            props =
              wrappedExpression.params[0]?.properties?.map(
                (prop: any) => prop?.key?.name,
              ) || [];
          }
        } else if (
          node.declaration.type === "ClassDeclaration" &&
          node.declaration.id?.name &&
          /^[A-Z]/.test(node.declaration.id.name)
        ) {
          componentName = node.declaration.id.name;
          const constructor = node.declaration.body.body.find(
            (method: any) => method.kind === "constructor",
          );
          props =
            constructor?.value?.params[0]?.properties?.map(
              (prop: any) => prop?.key?.name,
            ) || [];
        } else {
          // Skip non-component default exports (e.g., objects, strings)
          return;
        }

        components.push({ name: componentName, props });
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
  let mainFile: string | null = null;

  for (const file of files) {
    if (!mainFile) {
      const code = await fs.readFile(file, "utf-8");
      const ast = parse(code, {
        sourceType: "module",
        plugins: ["jsx", "typescript"],
      });

      let isMainFile = false;
      try {
        // @ts-ignore
        traverse.default(ast, {
          CallExpression({ node }: { node: any }) {
            // Check for ReactDOM.render or ReactDOM.createRoot(...).render
            if (
              (node.callee.object?.name === "ReactDOM" &&
                (node.callee.property?.name === "render" ||
                  node.callee.property?.name === "createRoot")) ||
              node.callee.name === "createRoot"
            ) {
              isMainFile = true;
            }
          },
        });
      } catch (e: any) {
        console.log(`Error parsing file ${file}:`, e);
      }

      if (isMainFile) {
        mainFile = file;
      }
    }

    const { filePath, components, usedComponents, routes } =
      await parseFile(file);
    if (filePath.toLowerCase().includes("main.")) {
      mainFile = filePath;
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
    name: "Root",
    children: [],
    file: mainFile,
    uses: [],
    props: [],
  };
  const visited = new Set<string>();

  function buildTree(
    nodeName: string,
    parentNode: TopographyNode,
    componentMap: Map<string, any>,
    visited: Set<string>,
  ) {
    // Skip if node has been visited to prevent cycles
    if (visited.has(nodeName)) return;
    visited.add(nodeName);

    // Get component info from the map
    const componentInfo = componentMap.get(nodeName);
    if (!componentInfo) return;

    // Create the current node
    const currentNode: TopographyNode = {
      name: nodeName,
      children: [],
      file: componentInfo.definedIn,
      props: componentInfo.props,
      uses: componentInfo.uses,
    };

    // Add current node to parent's children (except for the root)
    if (parentNode.name !== "Root" || nodeName === "App") {
      parentNode.children.push(currentNode);
    }

    componentInfo.routes.forEach((route: Route) => {
      const routeNode: TopographyNode = {
        name: `Route: ${route.path}`,
        children: [],
        file: componentInfo.definedIn,
        props: componentInfo.props,
        uses: componentInfo.uses,
      };
      parentNode.children.push(routeNode);
      buildTree(route.component, routeNode, componentMap, visited);
    });

    // Recursively build tree for each used component
    componentInfo.uses.forEach((comp: string) => {
      if (componentMap.has(comp) && comp !== nodeName) {
        buildTree(comp, currentNode, componentMap, visited);
      }
    });
  }

  if (mainFile) {
    const { usedComponents, components: mainFileComponents } =
      await parseFile(mainFile);

    // Parse the AST of the main file to find the JSX structure in ReactDOM.render
    const code = await fs.readFile(mainFile, "utf-8");
    const ast = parse(code, {
      sourceType: "module",
      plugins: ["jsx", "typescript"],
    });

    let rootComponentChain: string[] = [];
    // @ts-ignore
    traverse.default(ast, {
      CallExpression({ node }: { node: any }) {
        // Look for ReactDOM.render or createRoot
        if (
          (node.callee.object?.name === "ReactDOM" &&
            (node.callee.property?.name === "render" ||
              node.callee.property?.name === "createRoot")) ||
          node.callee.name === "createRoot"
        ) {
          // Get the first argument (the JSX element)
          const jsxElement = node.arguments[0];
          const components: string[] = [];

          // Recursively collect capitalized components from JSX
          function collectComponents(element: any) {
            if (element?.type === "JSXElement") {
              const componentName = element.openingElement.name.name;
              if (componentName && /^[A-Z]/.test(componentName)) {
                components.push(componentName);
                // Recurse into children
                element.children.forEach((child: any) =>
                  collectComponents(child),
                );
              }
            }
          }

          collectComponents(jsxElement);
          rootComponentChain = components;
        }
      },
    });

    // Build the tree starting from the first component in the chain
    if (rootComponentChain.length > 0 || usedComponents.length > 0) {
      let currentParent = topography;
      rootComponentChain.forEach((componentName, index) => {
        if (visited.has(componentName)) return;
        const componentInfo = componentMap.get(componentName) || {
          definedIn: null,
          uses: [],
          routes: [],
          props: [],
        };
        const node: TopographyNode = {
          name: componentName,
          children: [],
          file: componentInfo.definedIn,
          props: componentInfo.props,
          uses: componentInfo.uses,
        };
        currentParent.children.push(node);
        // If this is not the last component, build the tree for its uses
        if (index < rootComponentChain.length - 1) {
          buildTree(componentName, node, componentMap, visited);
        }
        currentParent = node;
      });
      // Build the tree for the last component (e.g., App) and its dependencies
      const lastComponent =
        rootComponentChain[rootComponentChain.length - 1] ||
        usedComponents[usedComponents.length - 1];
      if (lastComponent) {
        buildTree(lastComponent, currentParent, componentMap, visited);
      }
    }
  }

  return topography;
}
