import React, { useCallback, useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import styled from 'styled-components';
import { Card, Intent, Tab, Tabs, TextArea } from '@blueprintjs/core';
import { withTheme } from '@rjsf/core';
import { Theme as MaterialUITheme } from '@rjsf/material-ui';
import { pick } from 'lodash';
import { useLocalStorage } from 'beautiful-react-hooks';
import useQueryString from 'use-query-string';
import { useTemplateGeneration } from './useTemplateGeneration';
import { collectSlots, emptyConfigurationString, IConfiguration, templateFileToNLCSTNodes } from '../src';
import { templates } from '../src';
import { ResultLine } from './result';
import { VFile } from 'vfile';

const Form = withTheme(MaterialUITheme);

const Container = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  min-height: 90vh;
`;
const ContentContainer = styled.div`
  display: flex;
  flex-direction: row;
  flex: 1;
  margin-top: 10px;
`;
const TemplateInputContainer = styled(Card)`
  display: flex;
  flex: 1;
  flex-direction: column;

  min-height: 100%;
  margin-right: 10px;
  & textarea {
    display: flex;
    max-height: 80vh;
    flex: 3;
  }
`;
const ConfigurationContainer = styled.div`
  display: flex;
  flex: 1;
  flex-direction: row;
  margin-top: 10px;
  & textarea {
    display: flex;
    flex: 1 !important;
    margin-left: 10px;
  }
`;
const ConfigJSONSchemaForm = styled(Form)`
  display: flex;
  flex: 3;
`;
const ErrorMessageContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
`;
const ResultContainer = styled(Card)`
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
`;

function updateQuery(path: string) {
  window.history.pushState(null, document.title, path);
}

function App(): JSX.Element {
  const [configString, configStringSetter] = useState<string>(emptyConfigurationString);
  const queryString = useQueryString(window.location, updateQuery);
  const [templateTab, templateTabSetter] = useState<keyof typeof templates>('空白');
  const [空白templateContent, 空白templateContentSetter] = useLocalStorage<string>('空白templateContent', templates['空白']);
  const [defaultConfigString, defaultConfigStringSetter] = useLocalStorage<string>('defaultConfigString', emptyConfigurationString);
  let configFormData: IConfiguration | undefined;
  try {
    configFormData = JSON.parse(configString) as IConfiguration;
  } catch {}
  const [rerender, template, templateSetter, result, configSchema, errorMessage, templateData] = useTemplateGeneration(configFormData, `${templateTab}.md`);
  useEffect(() => {
    templates['空白'] = 空白templateContent;
    const tabFromQueryString = queryString[0].tab as keyof typeof templates | undefined;
    if (tabFromQueryString) {
      templateTabSetter(tabFromQueryString);
      templateSetter(templates[tabFromQueryString]);
    } else {
      templateSetter(templates[templateTab]);
    }
    const configStringFromQueryString = queryString[0].conf as string | undefined;
    if (configStringFromQueryString) {
      try {
        JSON.parse(configStringFromQueryString);
        defaultConfigStringSetter(configStringFromQueryString);
      } catch {}
    }
    configStringSetter(defaultConfigString);
  }, []);

  const updateConfigString = useCallback(
    (nextConfigString: string) => {
      const parsedConfig = JSON.parse(nextConfigString);
      // if no error thrown
      configStringSetter(nextConfigString);
      defaultConfigStringSetter(nextConfigString);
      let usedSlots: string[] = [];
      if (templateData !== undefined) {
        usedSlots = collectSlots(templateData);
      } else {
        const vFile = new VFile({ path: 'input.md', value: template });
        const templateDataTemp = templateFileToNLCSTNodes(vFile);
        usedSlots = collectSlots(templateDataTemp);
      }
      queryString[1]({ conf: JSON.stringify({ ...parsedConfig, substitutions: pick(parsedConfig.substitutions, usedSlots) }) });
    },
    [templateData, template],
  );

  return (
    <Container>
      <ContentContainer>
        <TemplateInputContainer>
          <Tabs
            id="Tabs"
            onChange={(nextTabName: keyof typeof templates) => {
              templateTabSetter(nextTabName);
              templateSetter(templates[nextTabName]);
              queryString[1]({ tab: nextTabName });
            }}
            selectedTabId={templateTab}>
            {Object.keys(templates).map((templateName) => (
              <Tab id={templateName} key={templateName} title={templateName} panel={<div />} />
            ))}
          </Tabs>
          <TextArea
            large={true}
            intent={Intent.PRIMARY}
            fill={true}
            onChange={(event) => {
              templateSetter(event.target.value);
              if (templateTab === '空白') {
                空白templateContentSetter(event.target.value);
              }
            }}
            value={template}
          />
          <ConfigurationContainer>
            {configSchema !== undefined && (
              <ConfigJSONSchemaForm
                formData={configFormData}
                schema={configSchema}
                onChange={(submitEvent) => {
                  const nextConfigString = JSON.stringify(submitEvent.formData);
                  updateConfigString(nextConfigString);
                }}
                onSubmit={() => rerender()}
              />
            )}
            <TextArea
              large={true}
              intent={Intent.PRIMARY}
              fill={true}
              onChange={(event) => {
                try {
                  // prevent invalid input
                  const nextConfigString = event.target.value;
                  updateConfigString(nextConfigString);
                } catch {}
              }}
              value={configString}
            />
          </ConfigurationContainer>
          <ErrorMessageContainer>{errorMessage}</ErrorMessageContainer>
        </TemplateInputContainer>
        <ResultContainer>
          {result.map((outputLine, index) => (
            <ResultLine key={index} outputLine={outputLine} />
          ))}
        </ResultContainer>
      </ContentContainer>
    </Container>
  );
}

const domContainer = document.querySelector('#app');
ReactDOM.render(<App />, domContainer);
