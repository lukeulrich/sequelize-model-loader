'use strict'

// Core
const fs = require('fs'),
	path = require('path')

// Vendor
const defaultsDeep = require('lodash.defaultsdeep'),
	inflection = require('inflection')

// Constants
const kModelFileNameSuffix = '.model.js' // All files ending with this are treated as models

/**
 * @param {String} directory - directory containing relevant models
 * @param {Object} sequelize - valid sequelize instance
 * @param {Object} [options = {}]
 * @param {String} [options.schema] - if model does not have a defined schema, set the model schema to ${options.schema}
 * @param {Object} [options.logger] - bunyan logger
 * @param {*} [options.context] - additional argument to pass to each model file when it is required
 * @returns {Object} - set of models that have been loaded
 */
module.exports = function(directory, sequelize, options = {}) {
	let models = {}

	getModelFileNames(directory)
	.forEach((modelFileName) => {
		let modelFile = path.resolve(directory, modelFileName),
			// eslint-disable-next-line global-require
			definition = require(modelFile)(sequelize.Sequelize, models, options.context)
		if (!definition)
			throw new Error(`Missing return value from model file, ${modelFileName}`)

		let modelName = nameForDefinition(definition, modelFileName)
		setupDefinition(definition, modelName)

		if (!definition.params.schema && options.schema)
			definition.params.schema = options.schema

		let model = models[modelName] = sequelize.define(modelName, definition.fields, definition.params)

		if (definition.params.noPrimaryKey)
			model.removeAttribute('id')

		// Expose the definition as a static member on the Model class; most useful for
		// introspection (e.g. generating documentation)
		model.definition = definition

		if (options.logger)
			options.logger.info({modelName, table: model.getTableName().toString()}, `Loaded model: ${modelName} (${model.getTableName().toString()} table)`)
	})

	return models
}

function getModelFileNames(directory) {
	return fs.readdirSync(directory)
	.filter((modelFileName) => modelFileName.endsWith(kModelFileNameSuffix))
	.sort()
}

function nameForDefinition(definition, modelFileName) {
	return 'name' in definition ? definition.name : nameFromFileName(modelFileName)
}

function nameFromFileName(modelFileName) {
	return path.basename(modelFileName, kModelFileNameSuffix)
}

function setupDefinition(definition, modelName) {
	let defaultParams = {
		tableName: defaultTableName(modelName)
	}

	if (!definition.params)
		definition.params = defaultParams
	else
		defaultsDeep(definition.params, defaultParams)
}

function defaultTableName(modelName) {
	return inflection.underscore(modelName)
		.split('_')
		.map((val) => inflection.pluralize(val))
		.join('_')
}
