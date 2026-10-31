COMMON_PASSWORDS = frozenset(
    """
    password1 password12 password123 password1234 password01 password11 password2
    passw0rd passw0rd1 p@ssw0rd p4ssword pa55word pa55w0rd
    qwerty123 qwerty1234 qwerty12 qwertyuiop1 1qaz2wsx 1q2w3e4r 1q2w3e4r5t
    q1w2e3r4 qazwsx123 zaq12wsx asdfghjk1 asdf1234 asdfgh123 zxcvbnm123
    abc12345 abcd1234 abcde12345 abc123456 abcdef123 a1b2c3d4 a1b2c3d4e5
    letmein1 letmein123 welcome1 welcome12 welcome123 welcome01
    admin123 admin1234 administrator1 root1234 login123 changeme1 changeme123
    iloveyou1 iloveyou12 iloveyou123 iloveu123 loveyou123 princess1 princess123
    football1 football123 baseball1 basketball1 soccer123 hockey123
    monkey123 monkey1234 dragon123 dragon1234 master123 superman1 batman123
    sunshine1 sunshine123 shadow123 shadow1234 michael123 jessica123 charlie123
    trustno1 trustno12 whatever1 freedom1 starwars1 hello1234 hello12345 hello123
    test1234 test12345 testing123 temp1234 secret123 guest1234 user1234 default123
    summer2020 summer2021 summer2022 summer2023 summer2024 summer2025
    winter2020 winter2021 winter2022 winter2023 winter2024 winter2025
    spring2024 spring2025 autumn2024 autumn2025 qwer1234 1234qwer 12345abc 123456abc
    abc123abc password2024 password2025 password2023 passw0rd123
    """.split()  # noqa: SIM905
)


def is_common_password(password):
    return password.lower() in COMMON_PASSWORDS
