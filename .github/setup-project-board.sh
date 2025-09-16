#!/bin/bash

# GitHub Projects Board Setup Script for Spur Browser Migration
# This script organizes the 30 existing issues into the project board structure

echo "🚀 Setting up GitHub Projects Board for Spur Browser Migration..."

# Repository information
REPO="houseofjuici/spur"
PROJECT_NAME="Spur Browser Migration - AI-Powered Browser Development"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Repository:${NC} $REPO"
echo -e "${BLUE}Project:${NC} $PROJECT_NAME"
echo ""

# Function to add labels to an issue
add_labels_to_issue() {
    local issue_number=$1
    shift
    local labels=("$@")
    
    echo -e "${YELLOW}Adding labels to issue #$issue_number:${NC} ${labels[*]}"
    gh issue edit "$issue_number" --add-label "${labels[@]}" 2>/dev/null || {
        echo -e "${RED}Failed to add labels to issue #$issue_number${NC}"
        return 1
    }
    return 0
}

# Function to assign issue to agent
assign_issue_to_agent() {
    local issue_number=$1
    local agent_label=$2
    
    echo -e "${GREEN}Assigning issue #$issue_number to agent:${NC} $agent_label"
    add_labels_to_issue "$issue_number" "$agent_label"
}

# Issue categorization based on analysis from gh issue list
echo -e "${BLUE}=== Organizing Issues by Phase and Priority ===${NC}"
echo ""

# Foundation Phase Issues (1-10)
FOUNDATION_ISSUES=(1 2 3 4 5 6 7 8 9 10)
echo -e "${YELLOW}Foundation Phase Issues:${NC} ${FOUNDATION_ISSUES[*]}"

# Integration Phase Issues (11-15)
INTEGRATION_ISSUES=(11 12 13 14 15)
echo -e "${YELLOW}Integration Phase Issues:${NC} ${INTEGRATION_ISSUES[*]}"

# Build Phase Issues (16-30)
BUILD_ISSUES=(16 17 18 19 20 21 22 23 24 25 26 27 28 29 30)
echo -e "${YELLOW}Build Phase Issues:${NC} ${BUILD_ISSUES[*]}"
echo ""

# Priority categorization
echo -e "${BLUE}=== Priority Categorization ===${NC}"

P0_ISSUES=(8 9 10 30)  # Critical issues from analysis
P1_ISSUES=(1 2 3 4 5 6 7 11 15 16 17 21 22 23 26)  # High priority issues
P2_ISSUES=(12 13 14 18 19 20 24 25 27 28 29)  # Medium priority issues

echo -e "${RED}P0 Critical Issues:${NC} ${P0_ISSUES[*]}"
echo -e "${YELLOW}P1 High Priority Issues:${NC} ${P1_ISSUES[*]}"
echo -e "${GREEN}P2 Medium Priority Issues:${NC} ${P2_ISSUES[*]}"
echo ""

# Agent assignment mapping
echo -e "${BLUE}=== Agent Assignment Strategy ===${NC}"

# Backend Developer (AI systems, core architecture)
BACKEND_ISSUES=(5 6 7 8 9 10 15)
echo -e "${GREEN}Backend Developer Issues:${NC} ${BACKEND_ISSUES[*]}"

# UI/UX Designer (interface, design system)
UI_ISSUES=(16 17 18 19 20)
echo -e "${GREEN}UI/UX Designer Issues:${NC} ${UI_ISSUES[*]}"

# DevOps Engineer (build system, deployment)
DEVOPS_ISSUES=(2 3 21 22 23 24 25)
echo -e "${GREEN}DevOps Engineer Issues:${NC} ${DEVOPS_ISSUES[*]}"

# Chrome Extension Developer (extension integration)
EXTENSION_ISSUES=(11 12 13 14)
echo -e "${GREEN}Chrome Extension Developer Issues:${NC} ${EXTENSION_ISSUES[*]}"

# Testing Specialist (testing framework, QA)
TESTING_ISSUES=(26 27 28 29 30)
echo -e "${GREEN}Testing Specialist Issues:${NC} ${TESTING_ISSUES[*]}"

# Web Developer (web components, UI)
WEB_ISSUES=(4 16 17 18 19 20)
echo -e "${GREEN}Web Developer Issues:${NC} ${WEB_ISSUES[*]}"

# Lead Coordinator (architecture, coordination)
COORDINATOR_ISSUES=(1)
echo -e "${GREEN}Lead Coordinator Issues:${NC} ${COORDINATOR_ISSUES[*]}"
echo ""

# Apply agent assignments
echo -e "${BLUE}=== Applying Agent Assignments ===${NC}"

for issue in "${BACKEND_ISSUES[@]}"; do
    assign_issue_to_agent "$issue" "agent:backend-developer"
done

for issue in "${UI_ISSUES[@]}"; do
    assign_issue_to_agent "$issue" "agent:ui-ux-designer"
done

for issue in "${DEVOPS_ISSUES[@]}"; do
    assign_issue_to_agent "$issue" "agent:devops-engineer"
done

for issue in "${EXTENSION_ISSUES[@]}"; do
    assign_issue_to_agent "$issue" "agent:chrome-extension-developer"
done

for issue in "${TESTING_ISSUES[@]}"; do
    assign_issue_to_agent "$issue" "agent:testing-specialist"
done

for issue in "${WEB_ISSUES[@]}"; do
    assign_issue_to_agent "$issue" "agent:web-developer"
done

for issue in "${COORDINATOR_ISSUES[@]}"; do
    assign_issue_to_agent "$issue" "agent:lead-coordinator"
done

echo ""

# Add priority swimlane labels
echo -e "${BLUE}=== Adding Priority Labels ===${NC}"

for issue in "${P0_ISSUES[@]}"; do
    add_labels_to_issue "$issue" "swimlane:P0-Critical"
done

for issue in "${P1_ISSUES[@]}"; do
    add_labels_to_issue "$issue" "swimlane:P1-High"
done

for issue in "${P2_ISSUES[@]}"; do
    add_labels_to_issue "$issue" "swimlane:P2-Medium"
done

echo ""

# Add phase labels
echo -e "${BLUE}=== Adding Phase Labels ===${NC}"

for issue in "${FOUNDATION_ISSUES[@]}"; do
    add_labels_to_issue "$issue" "phase:foundation"
done

for issue in "${INTEGRATION_ISSUES[@]}"; do
    add_labels_to_issue "$issue" "phase:integration"
done

for issue in "${BUILD_ISSUES[@]}"; do
    add_labels_to_issue "$issue" "phase:build"
done

echo ""

# Set initial status for prioritized issues
echo -e "${BLUE}=== Setting Initial Status for Prioritized Issues ===${NC}"

# Move P0 and P1 issues to "Prioritized" column
PRIORITIZED_ISSUES=("${P0_ISSUES[@]}" "${P1_ISSUES[@]}")
echo -e "${YELLOW}Moving issues to Prioritized column:${NC} ${PRIORITIZED_ISSUES[*]}"

for issue in "${PRIORITIZED_ISSUES[@]}"; do
    add_labels_to_issue "$issue" "status:prioritized"
    echo -e "${GREEN}Issue #$issue marked as prioritized${NC}"
done

echo ""

# Create summary report
echo -e "${BLUE}=== Project Board Setup Summary ===${NC}"
echo -e "${GREEN}✓ Total Issues Processed:${NC} 30"
echo -e "${GREEN}✓ Agent Assignments:${NC} 7 agents assigned"
echo -e "${GREEN}✓ Priority Categorization:${NC} P0(${#P0_ISSUES[@]}), P1(${#P1_ISSUES[@]}), P2(${#P2_ISSUES[@]})"
echo -e "${GREEN}✓ Phase Organization:${NC} Foundation(${#FOUNDATION_ISSUES[@]}), Integration(${#INTEGRATION_ISSUES[@]}), Build(${#BUILD_ISSUES[@]})"
echo -e "${GREEN}✓ Status Initialization:${NC} ${#PRIORITIZED_ISSUES[@]} issues prioritized"
echo ""

echo -e "${BLUE}=== Next Steps ===${NC}"
echo "1. Create the GitHub Project board manually with the specified columns"
echo "2. Import all issues using the GitHub Projects interface"
echo "3. Set up automation rules as specified in the configuration"
echo "4. Configure the different views (Board, Table, Roadmap, Agent Workload)"
echo "5. Assign actual GitHub users to agent roles"
echo "6. Begin development work on prioritized issues"
echo ""

echo -e "${GREEN}🎉 GitHub Projects board setup completed!${NC}"
echo -e "${YELLOW}Note: Manual setup in GitHub interface is still required for the actual project board creation and automation rules.${NC}"