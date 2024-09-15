SRC_FILES := $(shell find src -type f)
PUBLIC_FILES := $(shell find public -type f)
SPECIFIC_FILES := package-lock.json package.json tsconfig.json

SOURCES := $(SRC_FILES) $(PUBLIC_FILES) $(SPECIFIC_FILES)
EXAMPLES := no_cycles_minimax cycles_minimax cycles_minimax_fix

TARGETS := $(patsubst %,output/%/index.html,$(EXAMPLES))
DEPLOY_DIR := ../../../assets/posts/three-mens-morris/examples


create_output_dir:
	mkdir -p output

output/%/index.html: $(SOURCES) | create_output_dir
	rm -rf $(dir $@)
	npm run build_$*


.PHONY: build
build: $(TARGETS)
	rm -rf $(DEPLOY_DIR)
	cp -r output $(DEPLOY_DIR)

.DEFAULT_GOAL := build
