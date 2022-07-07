// Copyright (c) jdneo. All rights reserved.
// Licensed under the MIT license.

import axios from "axios"
import * as vscode from "vscode";
import { leetCodeExecutor } from "../leetCodeExecutor";
import { leetCodeManager } from "../leetCodeManager";
import { DailyProblem, DailyProblemSet, IProblem, ProblemState, UserStatus } from "../shared";
import * as settingUtils from "../utils/settingUtils";
import { DialogType, promptForOpenOutputChannel } from "../utils/uiUtils";

export async function listProblems(): Promise<IProblem[]> {
    try {
        if (leetCodeManager.getStatus() === UserStatus.SignedOut) {
            return [];
        }
        const leetCodeConfig: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration("leetcode");
        const showLocked: boolean = !!leetCodeConfig.get<boolean>("showLocked");
        const useEndpointTranslation: boolean = settingUtils.shouldUseEndpointTranslation();
        const result: string = await leetCodeExecutor.listProblems(showLocked, useEndpointTranslation);
        const problems: IProblem[] = [];
        const lines: string[] = result.split("\n");
        const reg: RegExp = /^(.)\s(.{1,2})\s(.)\s\[\s*(\d*)\s*\]\s*(.*)\s*(Easy|Medium|Hard)\s*\((\s*\d+\.\d+ %)\)/;
        const { companies, tags } = await leetCodeExecutor.getCompaniesAndTags();
        for (const line of lines) {
            const match: RegExpMatchArray | null = line.match(reg);
            if (match && match.length === 8) {
                const id: string = match[4].trim();
                problems.push({
                    id,
                    isFavorite: match[1].trim().length > 0,
                    locked: match[2].trim().length > 0,
                    state: parseProblemState(match[3]),
                    name: match[5].trim(),
                    difficulty: match[6].trim(),
                    passRate: match[7].trim(),
                    companies: companies[id] || ["Unknown"],
                    tags: tags[id] || ["Unknown"],
                });
            }
        }
        return problems.reverse();
    } catch (error) {
        await promptForOpenOutputChannel("Failed to list problems. Please open the output channel for details.", DialogType.error);
        return [];
    }
}

export async function listDailyProblems(context: vscode.ExtensionContext): Promise<DailyProblem[]> {
    try {
        const cookie = context.globalState.get<string>("cookie")
        if (leetCodeManager.getStatus() === UserStatus.SignedOut || cookie === undefined) {
            return [];
        }
        const date = new Date();
        const res = await axios.post<DailyProblemSet>(
            "https://leetcode.cn/graphql/", {
            "query": "\n    query dailyQuestionRecords($year: Int!, $month: Int!) {\n  dailyQuestionRecords(year: $year, month: $month) {\n    date\n    userStatus\n    question {\n      questionFrontendId\n      title\n      titleSlug\n      translatedTitle\n    }\n  }\n}\n    ",
            "variables": {
                "year": date.getFullYear(),
                "month": date.getMonth() + 1,
            }
        }, {
            headers: {
                cookie,
            },
        })
        return res.data.data.dailyQuestionRecords;
    } catch (e) {
        await promptForOpenOutputChannel("Failed to list daily Problems. Please open the output channel for details.", DialogType.error);
        return []
    }
}

function parseProblemState(stateOutput: string): ProblemState {
    if (!stateOutput) {
        return ProblemState.Unknown;
    }
    switch (stateOutput.trim()) {
        case "v":
        case "✔":
        case "√":
            return ProblemState.AC;
        case "X":
        case "✘":
        case "×":
            return ProblemState.NotAC;
        default:
            return ProblemState.Unknown;
    }
}
