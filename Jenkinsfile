pipeline {
    agent any

    environment {
        COMMIT_SHA = "${env.GIT_COMMIT ?: 'unknown'}"
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Hygiene Check') {
            steps {
                sh 'bash scripts/hygiene.sh'
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'make install'
            }
        }

        stage('Run Tests') {
            steps {
                sh 'make test'
            }
        }

        stage('Build Project') {
            steps {
                sh 'make build'
            }
        }
    }

    post {
        always {
            cleanWs()
        }
        success {
            echo "Pipeline succeeded!"
        }
        failure {
            echo "Pipeline failed!"
        }
    }
}
