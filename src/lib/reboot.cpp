#include <cstdlib>
#include <cstring>
#include <iostream>
#include <signal.h>
#include <sys/wait.h>
#include <unistd.h>

int main(int argc, char *argv[]) {
  if (argc < 3) {
    std::cerr << "Usage: " << argv[0] << " <pid> <project_dir>" << std::endl;
    return 1;
  }

  pid_t targetPid = std::atoi(argv[1]);
  const char *projectDir = argv[2];

  if (targetPid <= 0) {
    std::cerr << "Invalid PID: " << argv[1] << std::endl;
    return 1;
  }

  std::cout << "[reboot] Killing process " << targetPid << "..." << std::endl;

  if (kill(targetPid, SIGTERM) != 0) {
    std::cerr << "[reboot] Failed to send SIGTERM: " << strerror(errno)
              << std::endl;
  }

  usleep(500000);

  if (kill(targetPid, 0) == 0) {
    std::cout << "[reboot] Process still alive, sending SIGKILL..."
              << std::endl;
    kill(targetPid, SIGKILL);
    usleep(200000);
  }

  std::cout << "[reboot] Process terminated. Restarting in " << projectDir
            << "..." << std::endl;

  if (chdir(projectDir) != 0) {
    std::cerr << "[reboot] Failed to change directory: " << strerror(errno)
              << std::endl;
    return 1;
  }

  pid_t child = fork();

  if (child < 0) {
    std::cerr << "[reboot] Fork failed: " << strerror(errno) << std::endl;
    return 1;
  }

  if (child == 0) {
    setsid();

    execlp("npm", "npm", "run", "dev", nullptr);
    std::cerr << "[reboot] Failed to exec npm: " << strerror(errno)
              << std::endl;
    _exit(1);
  }

  std::cout << "[reboot] Started new process with PID " << child << std::endl;

  return 0;
}
