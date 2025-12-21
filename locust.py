# locust.py for load testing
from locust import HttpUser, task, between
import time

class KitabUser(HttpUser):
    wait_time = between(1, 5)

    # locust -f locust.py --host "http://31.97.228.246:81/kitabapi/api/book/version/newgetpages?versionId=27fed631-482c-4239-b9c5-c9793c0f1d9c&startPage=1&endPage=1" --users 1000 --spawn-rate 10
 
    @task
    def index(self):
        self.client.get("/api/book/version/newgetpahttp://31.97.228.246:81/kitabapi/api/book/version/newgetpages?versionId=27fed631-482c-4239-b9c5-c9793c0f1d9c&startPage=1&endPage=1ges?versionId=27fed631-482c-4239-b9c5-c9793c0f1d9c&startPage=1&endPage=1")
        time.sleep(1)

   



       
