# MegAI - AdonisJS Project Context

## Build/Test/Lint Commands

- `npm run dev` - Start development server with HMR
- `npm run build` - Build for production
- `npm run test` - Run all tests
- `node ace test --files=path/to/test.ts` - Run single test file
- `node ace test --tests="test name"` - Run specific test by name
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run typecheck` - TypeScript type checking

## Code Style & Conventions

- **Framework**: AdonisJS v6 with TypeScript
- **Imports**: Use `#` aliases (e.g., `#controllers/*`, `#services/*`, `#models/*`)
- **Classes**: PascalCase with descriptive names (e.g., `HttpExceptionHandler`, `ContainerBindingsMiddleware`)
- **Methods**: camelCase, async methods return promises
- **Types**: Use TypeScript types from AdonisJS core (e.g., `HttpContext`, `NextFn`)
- **Error Handling**: Extend `ExceptionHandler` for custom error handling
- **Comments**: Use JSDoc for class/method documentation, inline comments sparingly
- **Formatting**: Prettier with @adonisjs/prettier-config
- **Linting**: ESLint with @adonisjs/eslint-config
