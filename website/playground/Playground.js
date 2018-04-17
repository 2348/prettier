import React from "react";

import { Button, ClipboardButton, LinkButton } from "./buttons";
import EditorState from "./EditorState";
import { DebugPanel, InputPanel, OutputPanel } from "./panels";
import PrettierFormat from "./PrettierFormat";
import VersionLink from "./VersionLink";
import { shallowEqual } from "./helpers";
import * as urlHash from "./urlHash";
import formatMarkdown from "./markdown";

import { Sidebar, SidebarCategory } from "./sidebar/components";
import SidebarOptions from "./sidebar/SidebarOptions";
import Option from "./sidebar/options";
import { Checkbox } from "./sidebar/inputs";

import WorkerApi from "./WorkerApi";

const CATEGORIES_ORDER = ["Global", "JavaScript", "Markdown", "Special"];

const ENABLED_OPTIONS = [
  "parser",
  "printWidth",
  "tabWidth",
  "useTabs",
  { name: "semi", inverted: true },
  "singleQuote",
  { name: "bracketSpacing", inverted: true },
  "jsxBracketSameLine",
  "arrowParens",
  "trailingComma",
  "proseWrap",
  "insertPragma",
  "requirePragma"
].map(option => (typeof option === "string" ? { name: option } : option));

class Playground extends React.Component {
  constructor() {
    super();

    this.state = Object.assign(
      {
        content: "",
        loaded: false,
        options: null
      },
      urlHash.read()
    );
    this.handleOptionValueChange = this.handleOptionValueChange.bind(this);

    this.setContent = content => this.setState({ content });
    this.clearContent = this.setContent.bind(this, "");
    this.resetOptions = () =>
      this.setState(state => ({
        options: getDefaultOptions(state.availableOptions)
      }));
  }

  componentDidMount() {
    this._worker = new WorkerApi("/worker.js");

    this._worker
      .postMessage({ type: "meta" })
      .then(({ supportInfo, version }) => {
        const availableOptions = parsePrettierOptions(supportInfo);
        const options = Object.assign(
          getDefaultOptions(availableOptions),
          this.state.options
        );

        this.setState({ loaded: true, availableOptions, options, version });
      });
  }

  componentDidUpdate(_, prevState) {
    const { content, options } = this.state;
    if (
      !shallowEqual(prevState.options, this.state.options) ||
      prevState.content !== content
    ) {
      urlHash.replace({ content, options });
    }
  }

  handleOptionValueChange(option, value) {
    this.setState(state => ({
      options: Object.assign({}, state.options, { [option.name]: value })
    }));
  }

  render() {
    const { availableOptions, content, loaded, options } = this.state;

    if (!loaded) return "Loading...";

    return (
      <React.Fragment>
        <VersionLink version={this.state.version} />
        <EditorState>
          {editorState => (
            <PrettierFormat
              worker={this._worker}
              code={content}
              options={options}
              debugAst={editorState.showAst}
              debugDoc={editorState.showDoc}
            >
              {({ formatted, debugAst, debugDoc }) => (
                <React.Fragment>
                  <div className="editors-container">
                    <Sidebar visible={editorState.showSidebar}>
                      <SidebarOptions
                        categories={CATEGORIES_ORDER}
                        availableOptions={availableOptions}
                        optionValues={options}
                        onOptionValueChange={this.handleOptionValueChange}
                      />
                      <SidebarCategory title="Debug">
                        <Checkbox
                          label="show AST"
                          checked={editorState.showAst}
                          onChange={editorState.toggleAst}
                        />
                        <Checkbox
                          label="show doc"
                          checked={editorState.showDoc}
                          onChange={editorState.toggleDoc}
                        />
                      </SidebarCategory>
                      <div className="sub-options">
                        <Button onClick={this.resetOptions}>
                          Reset to defaults
                        </Button>
                      </div>
                    </Sidebar>
                    <div className="editors">
                      <InputPanel
                        mode={getCodemirrorMode(options.parser)}
                        rulerColumn={options.printWidth}
                        value={content}
                        onChange={this.setContent}
                      />
                      {editorState.showAst ? (
                        <DebugPanel value={debugAst} />
                      ) : null}
                      {editorState.showDoc ? (
                        <DebugPanel value={debugDoc} />
                      ) : null}
                      <OutputPanel
                        mode={getCodemirrorMode(options.parser)}
                        value={formatted}
                        rulerColumn={options.printWidth}
                      />
                    </div>
                  </div>
                  <div className="bottom-bar">
                    <div className="bottom-bar-buttons">
                      <Button onClick={editorState.toggleSidebar}>
                        {editorState.showSidebar ? "Hide" : "Show"} options
                      </Button>
                      <Button onClick={this.clearContent}>Clear</Button>
                    </div>
                    <div className="bottom-bar-buttons bottom-bar-buttons-right">
                      <ClipboardButton clipboardValue={window.location.href}>
                        Copy link
                      </ClipboardButton>
                      <Button>Copy markdown</Button>
                      <LinkButton href="#" target="_blank" rel="noopener">
                        Report issue
                      </LinkButton>
                    </div>
                  </div>
                </React.Fragment>
              )}
            </PrettierFormat>
          )}
        </EditorState>
      </React.Fragment>
    );
  }
}

function getDefaultOptions(availableOptions) {
  return availableOptions.reduce((acc, option) => {
    acc[option.name] = option.default;
    return acc;
  }, {});
}

function getCodemirrorMode(parser) {
  switch (parser) {
    case "css":
    case "less":
    case "scss":
      return "css";
    case "graphql":
      return "graphql";
    case "markdown":
      return "markdown";
    default:
      return "jsx";
  }
}

function parsePrettierOptions(supportInfo) {
  const supportedOptions = supportInfo.options.reduce((acc, option) => {
    acc[option.name] = option;
    return acc;
  }, {});

  return ENABLED_OPTIONS.reduce((optionsList, optionConfig) => {
    if (!supportedOptions[optionConfig.name]) return optionsList;

    const option = Object.assign(
      {},
      optionConfig,
      supportedOptions[optionConfig.name]
    );
    option.cliName =
      "--" +
      (option.inverted ? "no-" : "") +
      option.name.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();

    optionsList.push(option);
    return optionsList;
  }, []);
}

export default Playground;
