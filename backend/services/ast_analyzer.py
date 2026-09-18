import os
import re
import asyncio
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple, Any

from tree_sitter import Parser, Node
import tree_sitter_languages

from backend.schemas import (
    FunctionInfo,
    ClassInfo,
    ImportInfo,
    RouteInfo,
    FileAnalysis,
    ProjectAnalysis,
)

# Extension to tree-sitter language identifier
LANGUAGE_MAP: Dict[str, str] = {
    ".ts": "typescript",
    ".tsx": "tsx",
    ".js": "javascript",
    ".jsx": "javascript",
    ".mjs": "javascript",
    ".cjs": "javascript",
    ".py": "python",
    ".go": "go",
    ".rs": "rust",
    ".java": "java",
    ".c": "c",
    ".h": "c",
    ".cpp": "cpp",
    ".hpp": "cpp",
    ".cc": "cpp",
    ".cxx": "cpp",
}

# Control flow node types for cyclomatic complexity calculation
COMPLEXITY_NODES: Set[str] = {
    "if_statement",
    "elif_clause",
    "for_statement",
    "for_in_statement",
    "while_statement",
    "do_statement",
    "switch_statement",
    "switch_case",
    "case_statement",
    "catch_clause",
    "except_clause",
    "conditional_expression",
    "ternary_expression",
    "match_statement",
    "try_statement"
}

# Directories to skip when scanning a project
IGNORED_DIRS: Set[str] = {
    "node_modules",
    ".git",
    "__pycache__",
    "dist",
    "build",
    ".next",
    ".nuxt",
    ".output",
    "target",
    "vendor",
    ".venv",
    "venv",
    ".idea",
    ".vscode",
    "coverage",
    ".pytest_cache",
    ".turbo",
    ".cache"
}

MAX_FILE_SIZE = 500 * 1024  # 500 KB


class ASTAnalyzer:
    """
    Multi-language AST analyzer using Tree-Sitter to extract structured
    code intelligence including functions, classes, imports, exports,
    React/Vue components, API routes, and cyclomatic complexity.
    """

    def __init__(self):
        self._parsers: Dict[str, Parser] = {}

    def get_parser(self, lang_name: str) -> Optional[Parser]:
        normalized = lang_name.lower().strip()
        if normalized == "jsx":
            normalized = "javascript"

        if normalized not in self._parsers:
            try:
                parser = tree_sitter_languages.get_parser(normalized)
                self._parsers[normalized] = parser
            except Exception:
                return None
        return self._parsers.get(normalized)

    def analyze_file(self, file_path: str, language: str) -> FileAnalysis:
        p = Path(file_path).resolve()
        if not p.exists() or not p.is_file():
            return FileAnalysis(file_path=str(p).replace("\\", "/"), language=language)

        try:
            if p.stat().st_size > MAX_FILE_SIZE:
                return FileAnalysis(file_path=str(p).replace("\\", "/"), language=language)
            source_bytes = p.read_bytes()
            source_text = source_bytes.decode("utf-8", errors="replace")
        except Exception:
            return FileAnalysis(file_path=str(p).replace("\\", "/"), language=language)

        parser = self.get_parser(language)
        if not parser:
            return FileAnalysis(file_path=str(p).replace("\\", "/"), language=language)

        try:
            tree = parser.parse(source_bytes)
            root_node = tree.root_node
        except Exception:
            return FileAnalysis(file_path=str(p).replace("\\", "/"), language=language)

        normalized_lang = language.lower()
        functions = self._extract_functions(root_node, source_bytes, normalized_lang)
        classes = self._extract_classes(root_node, source_bytes, normalized_lang)
        imports = self._extract_imports(root_node, source_bytes, normalized_lang)
        exports = self._extract_exports(root_node, source_bytes, normalized_lang)
        components = self._extract_components(root_node, source_bytes, normalized_lang)
        api_routes = self._extract_api_routes(root_node, source_bytes, normalized_lang)
        complexity_score = self._compute_complexity(root_node, source_bytes)

        return FileAnalysis(
            file_path=str(p).replace("\\", "/"),
            language=language,
            functions=functions,
            classes=classes,
            imports=imports,
            exports=exports,
            components=components,
            api_routes=api_routes,
            complexity_score=complexity_score
        )

    async def analyze_project(
        self, project_path: str, languages: Optional[List[str]] = None
    ) -> ProjectAnalysis:
        root = Path(project_path).resolve()
        if not root.exists() or not root.is_dir():
            return ProjectAnalysis()

        norm_langs = set()
        if languages:
            for l in languages:
                ll = l.lower().strip()
                norm_langs.add(ll)
                if ll in ("typescript", "ts"):
                    norm_langs.add("tsx")
                elif ll in ("javascript", "js"):
                    norm_langs.add("jsx")

        files_to_analyze: List[Tuple[Path, str]] = []
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = [d for d in dirnames if d not in IGNORED_DIRS]

            for fname in filenames:
                ext = Path(fname).suffix.lower()
                if ext in LANGUAGE_MAP:
                    lang = LANGUAGE_MAP[ext]
                    if not norm_langs or lang in norm_langs:
                        fpath = Path(dirpath) / fname
                        try:
                            if fpath.stat().st_size <= MAX_FILE_SIZE:
                                files_to_analyze.append((fpath, lang))
                        except OSError:
                            pass

        semaphore = asyncio.Semaphore(20)

        async def analyze_with_semaphore(fpath: Path, lang: str) -> FileAnalysis:
            async with semaphore:
                return await asyncio.to_thread(self.analyze_file, str(fpath), lang)

        tasks = [analyze_with_semaphore(fpath, lang) for fpath, lang in files_to_analyze]
        analyses: List[FileAnalysis] = await asyncio.gather(*tasks)

        total_functions = sum(len(fa.functions) for fa in analyses)
        total_classes = sum(len(fa.classes) for fa in analyses)

        # Build component dependency tree
        all_components: Set[str] = set()
        file_to_components: Dict[str, List[str]] = {}
        for fa in analyses:
            if fa.components:
                all_components.update(fa.components)
                file_to_components[fa.file_path] = fa.components

        component_tree: Dict[str, List[str]] = {}
        for fa in analyses:
            if not fa.components:
                continue
            imported_components: Set[str] = set()
            for imp in fa.imports:
                for name in imp.names:
                    if name in all_components:
                        imported_components.add(name)

            for comp in fa.components:
                if comp not in component_tree:
                    component_tree[comp] = []
                for imported in imported_components:
                    if imported != comp and imported not in component_tree[comp]:
                        component_tree[comp].append(imported)

        return ProjectAnalysis(
            files=analyses,
            total_functions=total_functions,
            total_classes=total_classes,
            component_tree=component_tree
        )

    # --------------------------------------------------------------------------
    # Extraction Helpers
    # --------------------------------------------------------------------------

    def _node_text(self, node: Node, source_bytes: bytes) -> str:
        return source_bytes[node.start_byte : node.end_byte].decode("utf-8", errors="replace").strip()

    def _extract_functions(self, root: Node, src: bytes, lang: str) -> List[FunctionInfo]:
        functions: List[FunctionInfo] = []

        def visit(node: Node):
            # Python functions
            if lang == "python" and node.type in ("function_definition", "async_function_definition"):
                name_node = node.child_by_field_name("name")
                if name_node:
                    name = self._node_text(name_node, src)
                    params = []
                    params_node = node.child_by_field_name("parameters")
                    if params_node:
                        for p in params_node.children:
                            if p.type in ("identifier", "default_parameter", "typed_parameter", "typed_default_parameter"):
                                p_name = self._node_text(p, src).split(":")[0].split("=")[0].strip()
                                if p_name and p_name not in (",", "(", ")"):
                                    params.append(p_name)

                    is_async = bool(
                        node.type == "async_function_definition"
                        or (node.prev_sibling is not None and self._node_text(node.prev_sibling, src) == "async")
                    )
                    functions.append(FunctionInfo(
                        name=name,
                        line_start=node.start_point[0] + 1,
                        line_end=node.end_point[0] + 1,
                        parameters=params,
                        is_async=is_async,
                        is_exported=not name.startswith("_")
                    ))

            # TypeScript / JavaScript / TSX
            elif lang in ("typescript", "tsx", "javascript"):
                if node.type in ("function_declaration", "generator_function_declaration"):
                    name_node = node.child_by_field_name("name")
                    if name_node:
                        name = self._node_text(name_node, src)
                        params = self._extract_js_params(node, src)
                        is_async = any(c.type == "async" for c in node.children)
                        is_exported = node.parent is not None and node.parent.type in ("export_statement", "export_default_declaration")
                        functions.append(FunctionInfo(
                            name=name,
                            line_start=node.start_point[0] + 1,
                            line_end=node.end_point[0] + 1,
                            parameters=params,
                            is_async=is_async,
                            is_exported=is_exported
                        ))

                # Arrow functions or function expressions assigned to variables: const foo = async () => {}
                elif node.type == "variable_declarator":
                    name_node = node.child_by_field_name("name")
                    val_node = node.child_by_field_name("value")
                    if name_node and val_node and val_node.type in ("arrow_function", "function", "function_expression"):
                        name = self._node_text(name_node, src)
                        params = self._extract_js_params(val_node, src)
                        is_async = any(c.type == "async" for c in val_node.children)
                        is_exported = False
                        curr = node.parent
                        while curr:
                            if curr.type in ("export_statement", "export_default_declaration"):
                                is_exported = True
                                break
                            curr = curr.parent

                        functions.append(FunctionInfo(
                            name=name,
                            line_start=node.start_point[0] + 1,
                            line_end=node.end_point[0] + 1,
                            parameters=params,
                            is_async=is_async,
                            is_exported=is_exported
                        ))

            # Go functions
            elif lang == "go" and node.type in ("function_declaration", "method_declaration"):
                name_node = node.child_by_field_name("name")
                if name_node:
                    name = self._node_text(name_node, src)
                    params = []
                    params_node = node.child_by_field_name("parameters")
                    if params_node:
                        for p in params_node.children:
                            if p.type == "parameter_declaration":
                                params.append(self._node_text(p, src))
                    is_exported = name[0].isupper() if name else False
                    functions.append(FunctionInfo(
                        name=name,
                        line_start=node.start_point[0] + 1,
                        line_end=node.end_point[0] + 1,
                        parameters=params,
                        is_async=False,
                        is_exported=is_exported
                    ))

            # Rust functions
            elif lang == "rust" and node.type == "function_item":
                name_node = node.child_by_field_name("name")
                if name_node:
                    name = self._node_text(name_node, src)
                    is_exported = any(c.type == "visibility_modifier" and "pub" in self._node_text(c, src) for c in node.children)
                    is_async = any(c.type == "async" for c in node.children)
                    params = []
                    params_node = node.child_by_field_name("parameters")
                    if params_node:
                        for p in params_node.children:
                            if p.type == "parameter":
                                params.append(self._node_text(p, src))
                    functions.append(FunctionInfo(
                        name=name,
                        line_start=node.start_point[0] + 1,
                        line_end=node.end_point[0] + 1,
                        parameters=params,
                        is_async=is_async,
                        is_exported=is_exported
                    ))

            # Java methods
            elif lang == "java" and node.type == "method_declaration":
                name_node = node.child_by_field_name("name")
                if name_node:
                    name = self._node_text(name_node, src)
                    is_exported = any(c.type == "modifiers" and "public" in self._node_text(c, src) for c in node.children)
                    params = []
                    params_node = node.child_by_field_name("parameters")
                    if params_node:
                        for p in params_node.children:
                            if p.type == "formal_parameter":
                                params.append(self._node_text(p, src))
                    functions.append(FunctionInfo(
                        name=name,
                        line_start=node.start_point[0] + 1,
                        line_end=node.end_point[0] + 1,
                        parameters=params,
                        is_async=False,
                        is_exported=is_exported
                    ))

            # C / C++ functions
            elif lang in ("c", "cpp") and node.type == "function_definition":
                decl = node.child_by_field_name("declarator")
                if decl:
                    # Resolve down to identifier
                    name_node = decl
                    while name_node and name_node.child_by_field_name("declarator"):
                        name_node = name_node.child_by_field_name("declarator")
                    if name_node:
                        id_node = name_node.child_by_field_name("name") or name_node
                        name = self._node_text(id_node, src)
                        functions.append(FunctionInfo(
                            name=name,
                            line_start=node.start_point[0] + 1,
                            line_end=node.end_point[0] + 1,
                            parameters=[],
                            is_async=False,
                            is_exported=True
                        ))

            for child in node.children:
                visit(child)

        visit(root)
        return functions

    def _extract_js_params(self, node: Node, src: bytes) -> List[str]:
        params: List[str] = []
        params_node = node.child_by_field_name("parameters") or node.child_by_field_name("parameter")
        if params_node:
            if params_node.type == "identifier":
                params.append(self._node_text(params_node, src))
            else:
                for p in params_node.children:
                    if p.type in ("identifier", "required_parameter", "optional_parameter", "assignment_pattern"):
                        txt = self._node_text(p, src).split(":")[0].split("=")[0].strip()
                        if txt and txt not in (",", "(", ")"):
                            params.append(txt)
        return params

    def _extract_classes(self, root: Node, src: bytes, lang: str) -> List[ClassInfo]:
        classes: List[ClassInfo] = []

        def visit(node: Node):
            # Python class
            if lang == "python" and node.type == "class_definition":
                name_node = node.child_by_field_name("name")
                if name_node:
                    name = self._node_text(name_node, src)
                    extends = None
                    superclasses = node.child_by_field_name("superclasses")
                    if superclasses:
                        ext_text = self._node_text(superclasses, src).strip("()")
                        extends = ext_text if ext_text else None

                    methods: List[str] = []
                    body = node.child_by_field_name("body")
                    if body:
                        for child in body.children:
                            if child.type in ("function_definition", "async_function_definition"):
                                m_name = child.child_by_field_name("name")
                                if m_name:
                                    methods.append(self._node_text(m_name, src))

                    classes.append(ClassInfo(
                        name=name,
                        line_start=node.start_point[0] + 1,
                        line_end=node.end_point[0] + 1,
                        methods=methods,
                        extends=extends
                    ))

            # TS / JS Class
            elif lang in ("typescript", "tsx", "javascript") and node.type == "class_declaration":
                name_node = node.child_by_field_name("name")
                if name_node:
                    name = self._node_text(name_node, src)
                    extends = None
                    heritage = [c for c in node.children if c.type in ("class_heritage", "extends_clause")]
                    if heritage:
                        ext_text = self._node_text(heritage[0], src).replace("extends", "").strip()
                        extends = ext_text if ext_text else None

                    methods: List[str] = []
                    body = node.child_by_field_name("body")
                    if body:
                        for child in body.children:
                            if child.type == "method_definition":
                                m_name = child.child_by_field_name("name")
                                if m_name:
                                    methods.append(self._node_text(m_name, src))

                    classes.append(ClassInfo(
                        name=name,
                        line_start=node.start_point[0] + 1,
                        line_end=node.end_point[0] + 1,
                        methods=methods,
                        extends=extends
                    ))

            # Java Class
            elif lang == "java" and node.type == "class_declaration":
                name_node = node.child_by_field_name("name")
                if name_node:
                    name = self._node_text(name_node, src)
                    extends = None
                    superclass = node.child_by_field_name("superclass")
                    if superclass:
                        extends = self._node_text(superclass, src).replace("extends", "").strip()

                    methods: List[str] = []
                    body = node.child_by_field_name("body")
                    if body:
                        for child in body.children:
                            if child.type == "method_declaration":
                                m_name = child.child_by_field_name("name")
                                if m_name:
                                    methods.append(self._node_text(m_name, src))

                    classes.append(ClassInfo(
                        name=name,
                        line_start=node.start_point[0] + 1,
                        line_end=node.end_point[0] + 1,
                        methods=methods,
                        extends=extends
                    ))

            # C++ Class / Struct
            elif lang in ("c", "cpp") and node.type in ("class_specifier", "struct_specifier"):
                name_node = node.child_by_field_name("name")
                if name_node:
                    name = self._node_text(name_node, src)
                    classes.append(ClassInfo(
                        name=name,
                        line_start=node.start_point[0] + 1,
                        line_end=node.end_point[0] + 1,
                        methods=[],
                        extends=None
                    ))

            for child in node.children:
                visit(child)

        visit(root)
        return classes

    def _extract_imports(self, root: Node, src: bytes, lang: str) -> List[ImportInfo]:
        imports: List[ImportInfo] = []

        def visit(node: Node):
            # Python import
            if lang == "python":
                if node.type == "import_statement":
                    # import foo, bar as b
                    for child in node.children:
                        if child.type == "dotted_name":
                            module = self._node_text(child, src)
                            imports.append(ImportInfo(
                                module=module,
                                names=[module],
                                is_default=True,
                                line=node.start_point[0] + 1
                            ))
                        elif child.type == "aliased_import":
                            d_name = child.child_by_field_name("name")
                            if d_name:
                                module = self._node_text(d_name, src)
                                imports.append(ImportInfo(
                                    module=module,
                                    names=[module],
                                    is_default=True,
                                    line=node.start_point[0] + 1
                                ))

                elif node.type == "import_from_statement":
                    # from foo import a, b
                    mod_node = node.child_by_field_name("module_name")
                    module = self._node_text(mod_node, src) if mod_node else ""
                    names: List[str] = []
                    for child in node.children:
                        if child.type in ("dotted_name", "identifier") and child != mod_node:
                            names.append(self._node_text(child, src))
                        elif child.type == "aliased_import":
                            orig = child.child_by_field_name("name")
                            if orig:
                                names.append(self._node_text(orig, src))

                    imports.append(ImportInfo(
                        module=module,
                        names=names,
                        is_default=False,
                        line=node.start_point[0] + 1
                    ))

            # TS / JS import
            elif lang in ("typescript", "tsx", "javascript"):
                if node.type == "import_statement":
                    source_node = node.child_by_field_name("source")
                    module = self._node_text(source_node, src).strip("'\"`") if source_node else ""
                    names: List[str] = []
                    is_default = False

                    clause = None
                    for c in node.children:
                        if c.type == "import_clause":
                            clause = c
                            break

                    if clause:
                        for c in clause.children:
                            if c.type == "identifier":
                                is_default = True
                                names.append(self._node_text(c, src))
                            elif c.type == "named_imports":
                                for spec in c.children:
                                    if spec.type == "import_specifier":
                                        n_node = spec.child_by_field_name("name")
                                        if n_node:
                                            names.append(self._node_text(n_node, src))
                            elif c.type == "namespace_import":
                                for sub in c.children:
                                    if sub.type == "identifier":
                                        names.append(self._node_text(sub, src))

                    imports.append(ImportInfo(
                        module=module,
                        names=names,
                        is_default=is_default,
                        line=node.start_point[0] + 1
                    ))

            # Go import
            elif lang == "go" and node.type == "import_spec":
                path_node = node.child_by_field_name("path")
                if path_node:
                    module = self._node_text(path_node, src).strip('"')
                    imports.append(ImportInfo(
                        module=module,
                        names=[module.split("/")[-1]],
                        is_default=True,
                        line=node.start_point[0] + 1
                    ))

            # Rust use
            elif lang == "rust" and node.type == "use_declaration":
                text = self._node_text(node, src).replace("use", "").rstrip(";").strip()
                module = text.split("::")[0]
                imports.append(ImportInfo(
                    module=module,
                    names=[text],
                    is_default=False,
                    line=node.start_point[0] + 1
                ))

            for child in node.children:
                visit(child)

        visit(root)
        return imports

    def _extract_exports(self, root: Node, src: bytes, lang: str) -> List[str]:
        exports: List[str] = []

        def visit(node: Node):
            if lang in ("typescript", "tsx", "javascript"):
                if node.type in ("export_statement", "export_default_declaration"):
                    decl = node.child_by_field_name("declaration")
                    if decl:
                        name_node = decl.child_by_field_name("name")
                        if name_node:
                            exports.append(self._node_text(name_node, src))
                        elif decl.type == "variable_statement":
                            for v in decl.children:
                                if v.type == "variable_declaration":
                                    for d in v.children:
                                        if d.type == "variable_declarator":
                                            n = d.child_by_field_name("name")
                                            if n:
                                                exports.append(self._node_text(n, src))

                    # Named export clause: export { Foo, Bar }
                    for c in node.children:
                        if c.type == "export_clause":
                            for spec in c.children:
                                if spec.type == "export_specifier":
                                    n = spec.child_by_field_name("name")
                                    if n:
                                        exports.append(self._node_text(n, src))

            elif lang == "python":
                # Check for __all__ = ["foo", "bar"]
                if node.type == "assignment":
                    left = node.child_by_field_name("left")
                    if left and self._node_text(left, src) == "__all__":
                        right = node.child_by_field_name("right")
                        if right:
                            for item in right.children:
                                if item.type == "string":
                                    exports.append(self._node_text(item, src).strip("'\""))

            for child in node.children:
                visit(child)

        visit(root)
        return list(dict.fromkeys(exports))

    def _extract_components(self, root: Node, src: bytes, lang: str) -> List[str]:
        components: List[str] = []
        if lang not in ("typescript", "tsx", "javascript"):
            return components

        def has_jsx(n: Node) -> bool:
            if n.type in ("jsx_element", "jsx_self_closing_element", "jsx_fragment"):
                return True
            return any(has_jsx(c) for c in n.children)

        def visit(node: Node):
            # Function declaration: function MyComponent() { return <div/> }
            if node.type == "function_declaration":
                name_node = node.child_by_field_name("name")
                if name_node:
                    name = self._node_text(name_node, src)
                    if name and name[0].isupper() and has_jsx(node):
                        components.append(name)

            # Variable declarator: const MyComponent = () => <div/> or React.FC
            elif node.type == "variable_declarator":
                name_node = node.child_by_field_name("name")
                val_node = node.child_by_field_name("value")
                if name_node and val_node:
                    name = self._node_text(name_node, src)
                    if name and name[0].isupper():
                        # Check for JSX or React.memo / forwardRef
                        if has_jsx(val_node) or "React.FC" in self._node_text(node, src):
                            components.append(name)

            for child in node.children:
                visit(child)

        visit(root)
        return list(dict.fromkeys(components))

    def _extract_api_routes(self, root: Node, src: bytes, lang: str) -> List[RouteInfo]:
        routes: List[RouteInfo] = []

        def visit(node: Node):
            # Python: FastAPI decorators @app.get("/items"), @router.post("/...")
            if lang == "python" and node.type == "decorated_definition":
                definition_node = node.child_by_field_name("definition")
                if not definition_node:
                    for c in node.children:
                        if c.type in ("function_definition", "async_function_definition"):
                            definition_node = c
                            break
                fn_name = "handler"
                fn_line = node.start_point[0] + 1
                if definition_node:
                    name_node = definition_node.child_by_field_name("name")
                    if name_node:
                        fn_name = self._node_text(name_node, src)
                    fn_line = definition_node.start_point[0] + 1

                for c in node.children:
                    if c.type == "decorator":
                        dec_text = self._node_text(c, src)
                        m = re.search(r"@\w+\.(get|post|put|delete|patch|options|head)\s*\(\s*['\"]([^'\"]+)['\"]", dec_text, re.IGNORECASE)
                        if m:
                            routes.append(RouteInfo(
                                method=m.group(1).upper(),
                                path=m.group(2),
                                handler_name=fn_name,
                                line=fn_line
                            ))

            # TS / JS: Express routes: app.get('/path', handler) or router.post('/path', handler)
            elif lang in ("typescript", "tsx", "javascript") and node.type == "call_expression":
                fn_node = node.child_by_field_name("function")
                if fn_node and fn_node.type == "member_expression":
                    prop_node = fn_node.child_by_field_name("property")
                    if prop_node:
                        method_name = self._node_text(prop_node, src).lower()
                        if method_name in ("get", "post", "put", "delete", "patch", "options", "head"):
                            args_node = node.child_by_field_name("arguments")
                            if args_node and len(args_node.children) > 1:
                                first_arg = args_node.children[1]  # first argument inside parentheses
                                if first_arg.type == "string":
                                    path = self._node_text(first_arg, src).strip("'\"`")
                                    routes.append(RouteInfo(
                                        method=method_name.upper(),
                                        path=path,
                                        handler_name="express_handler",
                                        line=node.start_point[0] + 1
                                    ))

            for child in node.children:
                visit(child)

        visit(root)
        return routes

    def _compute_complexity(self, root: Node, src: bytes) -> int:
        score = 1

        def visit(node: Node):
            nonlocal score
            if node.type in COMPLEXITY_NODES:
                score += 1
            elif node.type in ("binary_expression", "boolean_operator"):
                op_node = node.child_by_field_name("operator")
                if op_node:
                    op = self._node_text(op_node, src)
                    if op in ("&&", "||", "and", "or"):
                        score += 1

            for child in node.children:
                visit(child)

        visit(root)
        return score


ast_analyzer = ASTAnalyzer()
