// Declarative pipeline for Krishi Clinic. Mirrors .github/workflows/ci.yml:
// hygiene -> install -> test -> build -> docker image + smoke test.
// Needs on the Jenkins agent: git, node 20, make, docker.
// For GitHub commit statuses, install the "GitHub" plugin and add a
// "Secret text" credential with id github-token (a PAT with repo:status).
pipeline {
    agent any

    options {
        timestamps()
        timeout(time: 20, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '20'))
    }

    environment {
        IMAGE = 'ghcr.io/skit-devops-2026/devops-24eskcs028'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                script {
                    env.SHORT_SHA = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
                }
                githubStatus('pending', 'Jenkins build started')
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

        stage('Docker Image') {
            steps {
                sh 'docker build --build-arg COMMIT_SHA=${GIT_COMMIT} -t ${IMAGE}:${SHORT_SHA} -t ${IMAGE}:latest .'
            }
        }

        stage('Smoke Test Container') {
            steps {
                sh '''
                    docker rm -f krishi-smoke-${BUILD_NUMBER} 2>/dev/null || true
                    docker run -d --name krishi-smoke-${BUILD_NUMBER} -p 0:5500 ${IMAGE}:${SHORT_SHA}
                    PORT=$(docker port krishi-smoke-${BUILD_NUMBER} 5500/tcp | head -1 | cut -d: -f2)
                    for i in $(seq 1 20); do curl -fs http://localhost:$PORT/health && break; sleep 1; done
                    curl -fs http://localhost:$PORT/metrics | grep -q http_requests_total
                '''
            }
            post {
                always {
                    sh 'docker rm -f krishi-smoke-${BUILD_NUMBER} || true'
                }
            }
        }
    }

    post {
        success {
            githubStatus('success', "Jenkins build #${env.BUILD_NUMBER} passed")
        }
        failure {
            githubStatus('failure', "Jenkins build #${env.BUILD_NUMBER} failed")
        }
        always {
            cleanWs()
        }
    }
}

// Posts a commit status to GitHub so the Jenkins result shows next to the
// GitHub Actions checks. Skipped quietly if the credential is not configured.
def githubStatus(String state, String description) {
    try {
        withCredentials([string(credentialsId: 'github-token', variable: 'GH_TOKEN')]) {
            sh """
                curl -fsS -X POST \
                  -H "Authorization: Bearer \$GH_TOKEN" \
                  -H "Accept: application/vnd.github+json" \
                  https://api.github.com/repos/skit-devops-2026/devops-24ESKCS028/statuses/\$(git rev-parse HEAD) \
                  -d '{"state":"${state}","context":"jenkins/krishi-clinic","description":"${description}","target_url":"${env.BUILD_URL}"}' \
                  > /dev/null
            """
        }
    } catch (err) {
        echo "GitHub status not posted (${err.getMessage()})"
    }
}
