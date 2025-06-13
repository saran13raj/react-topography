# React Topography

A CLI tool to generate a topography of React component relationships.

## Description

React Topography is a command-line tool that visualizes the component hierarchy and relationships in React applications. It generates an interactive static site displaying a flow from the root of the app to its components, allowing you to explore their connections.

## Installation

```bash
npm install -g react-topography
```

## Usage

Run the CLI from your project’s root directory, specifying the source directory where your React code resides (e.g., where `main.tsx` or `app.tsx` is located) using the `-s` flag.

### Command

```bash
react-topography -s <source-directory>
```

#### Examples

- If your React code is in the `src` directory:

  ```bash
  react-topography -s ./src
  ```

- If your React code is in `packages/demo/src`:
  ```bash
  react-topography -s ./packages/demo/src
  ```

After running the command, the tool spins up a static site at `http://localhost:4001/`. The site displays an interactive visualization of your React app’s component relationships, where you can:

- Drag nodes to reposition them
- Zoom in and out
- Move around the topography

## Supported Environments

React Topography currently supports React applications created with:

- **Create React App**
- **Vite**

**Note**: Support for Next.js or Remix React apps is not yet available.

## Limitations

- The tool may have bugs, and some components might not be recognized.
- It may not work well for default exports that are imported with a different name than the export name.

## Contributing

Feel free to report issues or contribute to the project on [GitHub](https://github.com/your-repo/react-topography). We welcome feedback and improvements!

## License

MIT
