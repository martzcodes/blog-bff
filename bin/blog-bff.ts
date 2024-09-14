#!/usr/bin/env node
import "source-map-support/register";
import { App } from "aws-cdk-lib";
import { BlogBffStack } from "../lib/blog-bff-stack";
import { BlogBffProjectStack } from "../lib/blog-bff-project-stack";

const app = new App();
new BlogBffStack(app, "BlogBffStack", {
  externalApis: {
    Users: "86qmfc4dy1",
  },
});
new BlogBffProjectStack(app, "BlogBffUsersStack", {
  projectName: "Users",
});
